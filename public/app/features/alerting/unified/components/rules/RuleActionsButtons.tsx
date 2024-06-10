import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Button,
  ClipboardButton,
  ConfirmModal,
  Dropdown,
  Icon,
  LinkButton,
  Menu,
  Tooltip,
  useStyles2,
  Stack,
} from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useDispatch } from 'app/types';
import { CombinedRule, RuleIdentifier, RulesSource } from 'app/types/unified-alerting';

import { AlertRuleAction, useAlertRuleAbility } from '../../hooks/useAbilities';
import { deleteRuleAction } from '../../state/actions';
import { getRulesSourceName } from '../../utils/datasource';
import { createShareLink, createViewLink } from '../../utils/misc';
import * as ruleId from '../../utils/rule-id';
import { isGrafanaRulerRule } from '../../utils/rules';
import { createUrl } from '../../utils/url';

import { RedirectToCloneRule } from './CloneRule';

export const matchesWidth = (width: number) => window.matchMedia(`(max-width: ${width}px)`).matches;

interface Props {
  rule: CombinedRule;
  rulesSource: RulesSource;
}

export const RuleActionsButtons = ({ rule, rulesSource }: Props) => {
  const dispatch = useDispatch();
  const location = useLocation();
  const notifyApp = useAppNotification();
  const style = useStyles2(getStyles);

  const [redirectToClone, setRedirectToClone] = useState<
    { identifier: RuleIdentifier; isProvisioned: boolean } | undefined
  >(undefined);

  const { namespace, group, rulerRule } = rule;
  const [ruleToDelete, setRuleToDelete] = useState<CombinedRule>();

  const returnTo = location.pathname + location.search;
  const isViewMode = inViewMode(location.pathname);

  const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);

  const [editRuleSupported, editRuleAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Update);
  const [deleteRuleSupported, deleteRuleAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Delete);
  const [duplicateRuleSupported, duplicateRuleAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Duplicate);
  const [modifyExportSupported, modifyExportAllowed] = useAlertRuleAbility(rule, AlertRuleAction.ModifyExport);

  const canEditRule = editRuleSupported && editRuleAllowed;
  const canDeleteRule = deleteRuleSupported && deleteRuleAllowed;
  const canDuplicateRule = duplicateRuleSupported && duplicateRuleAllowed;
  const canModifyExport = modifyExportSupported && modifyExportAllowed;

  const buttons: JSX.Element[] = [];
  const moreActions: JSX.Element[] = [];

  const deleteRule = () => {
    if (ruleToDelete && ruleToDelete.rulerRule) {
      const identifier = ruleId.fromRulerRule(
        getRulesSourceName(ruleToDelete.namespace.rulesSource),
        ruleToDelete.namespace.name,
        ruleToDelete.group.name,
        ruleToDelete.rulerRule
      );

      dispatch(deleteRuleAction(identifier, { navigateTo: isViewMode ? '/alerting/list' : undefined }));
      setRuleToDelete(undefined);
    }
  };

  const buildShareUrl = () => createShareLink(rulesSource, rule);

  const sourceName = getRulesSourceName(rulesSource);

  if (!isViewMode) {
    buttons.push(
      <Tooltip placement="top" content={'View'}>
        <LinkButton
          className={style.button}
          title="View"
          size="sm"
          key="view"
          variant="secondary"
          icon="eye"
          href={createViewLink(rulesSource, rule, returnTo)}
        />
      </Tooltip>
    );
  }

  if (rulerRule) {
    const identifier = ruleId.fromRulerRule(sourceName, namespace.name, group.name, rulerRule);

    if (canEditRule) {
      const editURL = createUrl(`/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/edit`, {
        returnTo,
      });

      buttons.push(
        <Tooltip placement="top" content={'Edit'}>
          <LinkButton
            title="Edit"
            className={style.button}
            size="sm"
            key="edit"
            variant="secondary"
            icon="pen"
            href={editURL}
          />
        </Tooltip>
      );
    }

    if (isViewMode) {
      buttons.push(
        <ClipboardButton
          key="copy"
          icon="copy"
          onClipboardError={(copiedText) => {
            notifyApp.error('Error while copying URL', copiedText);
          }}
          className={style.button}
          size="sm"
          getText={buildShareUrl}
        >
          Copy link to rule
        </ClipboardButton>
      );
    }

    if (canDuplicateRule) {
      moreActions.push(
        <Menu.Item label="Duplicate" icon="copy" onClick={() => setRedirectToClone({ identifier, isProvisioned })} />
      );
    }

    if (canModifyExport) {
      moreActions.push(
        <Menu.Item
          label="Modify export"
          icon="edit"
          url={createUrl(`/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/modify-export`, {
            returnTo: location.pathname + location.search,
          })}
        />
      );
    }

    if (canDeleteRule) {
      moreActions.push(<Menu.Item label="Delete" icon="trash-alt" onClick={() => setRuleToDelete(rule)} />);
    }
  }

  if (buttons.length || moreActions.length) {
    return (
      <>
        <Stack gap={1}>
          {buttons.map((button, index) => (
            <React.Fragment key={index}>{button}</React.Fragment>
          ))}
          {moreActions.length > 0 && (
            <Dropdown
              overlay={
                <Menu>
                  {moreActions.map((action) => (
                    <React.Fragment key={uniqueId('action_')}>{action}</React.Fragment>
                  ))}
                </Menu>
              }
            >
              <Button variant="secondary" size="sm">
                More
                <Icon name="angle-down" />
              </Button>
            </Dropdown>
          )}
        </Stack>
        {!!ruleToDelete && (
          <ConfirmModal
            isOpen={true}
            title="Delete rule"
            body={
              <div>
                <p>
                  Deleting &quot;<strong>{ruleToDelete.name}</strong>&quot; will permanently remove it from your alert
                  rule list.
                </p>
                <p>Are you sure you want to delete this rule?</p>
              </div>
            }
            confirmText="Yes, delete"
            icon="exclamation-triangle"
            onConfirm={deleteRule}
            onDismiss={() => setRuleToDelete(undefined)}
          />
        )}

        {redirectToClone && (
          <RedirectToCloneRule
            identifier={redirectToClone.identifier}
            isProvisioned={redirectToClone.isProvisioned}
            onDismiss={() => setRedirectToClone(undefined)}
          />
        )}
      </>
    );
  }

  return null;
};

function inViewMode(pathname: string): boolean {
  return pathname.endsWith('/view');
}

export const getStyles = (theme: GrafanaTheme2) => ({
  button: css`
    padding: 0 ${theme.spacing(2)};
  `,
});

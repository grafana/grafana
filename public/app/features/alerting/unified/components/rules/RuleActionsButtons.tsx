import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
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
} from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useDispatch } from 'app/types';
import { CombinedRule, RuleIdentifier, RulesSource } from 'app/types/unified-alerting';

import { contextSrv } from '../../../../../core/services/context_srv';
import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';
import { deleteRuleAction } from '../../state/actions';
import { provisioningPermissions } from '../../utils/access-control';
import { getRulesSourceName } from '../../utils/datasource';
import { createShareLink, createViewLink } from '../../utils/misc';
import * as ruleId from '../../utils/rule-id';
import { isFederatedRuleGroup, isGrafanaRulerRule } from '../../utils/rules';
import { createUrl } from '../../utils/url';
import { GrafanaRuleExporter } from '../export/GrafanaRuleExporter';

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
  const [showExportDrawer, toggleShowExportDrawer] = useToggle(false);

  const { namespace, group, rulerRule } = rule;
  const [ruleToDelete, setRuleToDelete] = useState<CombinedRule>();

  const rulesSourceName = getRulesSourceName(rulesSource);

  const canReadProvisioning = contextSrv.hasPermission(provisioningPermissions.read);
  const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);

  const buttons: JSX.Element[] = [];
  const moreActions: JSX.Element[] = [];

  const isFederated = isFederatedRuleGroup(group);
  const { isEditable, isRemovable } = useIsRuleEditable(rulesSourceName, rulerRule);
  const returnTo = location.pathname + location.search;
  const isViewMode = inViewMode(location.pathname);

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

  if (isEditable && rulerRule && !isFederated) {
    const identifier = ruleId.fromRulerRule(sourceName, namespace.name, group.name, rulerRule);

    if (!isProvisioned) {
      const editURL = createUrl(`/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/edit`, {
        returnTo,
      });

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

    if (isGrafanaRulerRule(rulerRule) && canReadProvisioning) {
      moreActions.push(<Menu.Item label="Export" icon="download-alt" onClick={toggleShowExportDrawer} />);
    }

    moreActions.push(
      <Menu.Item label="Duplicate" icon="copy" onClick={() => setRedirectToClone({ identifier, isProvisioned })} />
    );
  }

  if (isRemovable && rulerRule && !isFederated && !isProvisioned) {
    moreActions.push(<Menu.Item label="Delete" icon="trash-alt" onClick={() => setRuleToDelete(rule)} />);
  }

  if (buttons.length) {
    return (
      <>
        <Stack gap={1}>
          {buttons.map((button, index) => (
            <React.Fragment key={index}>{button}</React.Fragment>
          ))}
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
        {showExportDrawer && isGrafanaRulerRule(rule.rulerRule) && (
          <GrafanaRuleExporter alertUid={rule.rulerRule.grafana_alert.uid} onClose={toggleShowExportDrawer} />
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

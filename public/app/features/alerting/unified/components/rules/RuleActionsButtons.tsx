import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Button, ClipboardButton, ConfirmModal, LinkButton, Tooltip, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useDispatch } from 'app/types';
import { CombinedRule, RulesSource } from 'app/types/unified-alerting';

import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';
import { deleteRuleAction } from '../../state/actions';
import { getRulesSourceName, isCloudRulesSource } from '../../utils/datasource';
import { createViewLink } from '../../utils/misc';
import * as ruleId from '../../utils/rule-id';
import { isFederatedRuleGroup, isGrafanaRulerRule } from '../../utils/rules';
import { createUrl } from '../../utils/url';

import { CloneRuleButton } from './CloneRuleButton';
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
  const { namespace, group, rulerRule } = rule;
  const [ruleToDelete, setRuleToDelete] = useState<CombinedRule>();

  const rulesSourceName = getRulesSourceName(rulesSource);

  const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);

  const buttons: JSX.Element[] = [];

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

  const buildShareUrl = () => {
    if (isCloudRulesSource(rulesSource)) {
      const { appUrl, appSubUrl } = config;
      const baseUrl = appSubUrl !== '' ? `${appUrl}${appSubUrl}/` : config.appUrl;
      const ruleUrl = `${encodeURIComponent(rulesSource.name)}/${encodeURIComponent(rule.name)}`;
      return `${baseUrl}alerting/${ruleUrl}/find`;
    }

    return window.location.href.split('?')[0];
  };

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
        ></LinkButton>
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

    buttons.push(
      <Tooltip placement="top" content="Copy">
        <CloneRuleButton ruleIdentifier={identifier} isProvisioned={isProvisioned} className={style.button} />
      </Tooltip>
    );
  }

  if (isRemovable && rulerRule && !isFederated && !isProvisioned) {
    buttons.push(
      <Tooltip placement="top" content={'Delete'}>
        <Button
          title="Delete"
          className={style.button}
          size="sm"
          type="button"
          key="delete"
          variant="secondary"
          icon="trash-alt"
          onClick={() => setRuleToDelete(rule)}
        />
      </Tooltip>
    );
  }

  if (buttons.length) {
    return (
      <>
        <Stack gap={1}>
          {buttons.map((button, index) => (
            <React.Fragment key={index}>{button}</React.Fragment>
          ))}
        </Stack>
        {!!ruleToDelete && (
          <ConfirmModal
            isOpen={true}
            title="Delete rule"
            body="Deleting this rule will permanently remove it from your alert rule list. Are you sure you want to delete this rule?"
            confirmText="Yes, delete"
            icon="exclamation-triangle"
            onConfirm={deleteRule}
            onDismiss={() => setRuleToDelete(undefined)}
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

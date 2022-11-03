import { css } from '@emotion/css';
import React, { FC, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  Button,
  ClipboardButton,
  ConfirmModal,
  HorizontalGroup,
  LinkButton,
  Tooltip,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
import { useDispatch } from 'app/types';
import { CombinedRule, RulesSource } from 'app/types/unified-alerting';

import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';
import { deleteRuleAction } from '../../state/actions';
import { getRulesSourceName, isCloudRulesSource } from '../../utils/datasource';
import { createViewLink } from '../../utils/misc';
import * as ruleId from '../../utils/rule-id';
import { isFederatedRuleGroup, isGrafanaRulerRule } from '../../utils/rules';

export const matchesWidth = (width: number) => window.matchMedia(`(max-width: ${width}px)`).matches;

interface Props {
  rule: CombinedRule;
  rulesSource: RulesSource;
}
function DontShowIfSmallDevice({ children }: { children: JSX.Element | string }) {
  const theme = useTheme2();
  const smBreakpoint = theme.breakpoints.values.xxl;
  const [isSmallScreen, setIsSmallScreen] = useState(matchesWidth(smBreakpoint));
  const style = useStyles2(getStyles);

  useMediaQueryChange({
    breakpoint: smBreakpoint,
    onChange: (e) => {
      setIsSmallScreen(e.matches);
    },
  });

  if (isSmallScreen) {
    return null;
  } else {
    return <div className={style.buttonText}>{children}</div>;
  }
}

export const RuleActionsButtons: FC<Props> = ({ rule, rulesSource }) => {
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

  if (!isViewMode) {
    buttons.push(
      <Tooltip placement="top" content={'View'}>
        <LinkButton
          className={style.button}
          size="xs"
          key="view"
          variant="secondary"
          icon="eye"
          href={createViewLink(rulesSource, rule, returnTo)}
        >
          <DontShowIfSmallDevice>View</DontShowIfSmallDevice>
        </LinkButton>
      </Tooltip>
    );
  }

  if (isEditable && rulerRule && !isFederated && !isProvisioned) {
    const sourceName = getRulesSourceName(rulesSource);
    const identifier = ruleId.fromRulerRule(sourceName, namespace.name, group.name, rulerRule);

    const editURL = urlUtil.renderUrl(
      `${config.appSubUrl}/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/edit`,
      {
        returnTo,
      }
    );

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
        <LinkButton className={style.button} size="xs" key="edit" variant="secondary" icon="pen" href={editURL}>
          <DontShowIfSmallDevice>Edit</DontShowIfSmallDevice>
        </LinkButton>
      </Tooltip>
    );
  }

  if (isRemovable && rulerRule && !isFederated && !isProvisioned) {
    buttons.push(
      <Tooltip placement="top" content={'Delete'}>
        <Button
          className={style.button}
          size="xs"
          type="button"
          key="delete"
          variant="secondary"
          icon="trash-alt"
          onClick={() => setRuleToDelete(rule)}
        >
          <DontShowIfSmallDevice>Delete</DontShowIfSmallDevice>
        </Button>
      </Tooltip>
    );
  }

  if (buttons.length) {
    return (
      <>
        <div className={style.wrapper}>
          <HorizontalGroup width="auto">
            {buttons.length ? buttons.map((button, index) => <div key={index}>{button}</div>) : <div />}
          </HorizontalGroup>
        </div>
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
  wrapper: css`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    flex-wrap: wrap;
  `,
  button: css`
    height: 24px;
    font-size: ${theme.typography.size.sm};
    svg {
      margin-right: 0;
    }
  `,
  buttonText: css`
    margin-left: 8px;
  `,
});

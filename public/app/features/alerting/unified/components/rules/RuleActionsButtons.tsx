import { css, cx } from '@emotion/css';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { LinkButton, Stack, useStyles2 } from '@grafana/ui';
import AlertRuleMenu from 'app/features/alerting/unified/components/rule-viewer/AlertRuleMenu';
import { useDeleteModal } from 'app/features/alerting/unified/components/rule-viewer/DeleteModal';
import { INSTANCES_DISPLAY_LIMIT } from 'app/features/alerting/unified/components/rules/RuleDetails';
import SilenceGrafanaRuleDrawer from 'app/features/alerting/unified/components/silences/SilenceGrafanaRuleDrawer';
import { useRulesFilter } from 'app/features/alerting/unified/hooks/useFilteredRules';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { useDispatch } from 'app/types';
import { CombinedRule, RuleIdentifier, RulesSource } from 'app/types/unified-alerting';

import { AlertRuleAction, useAlertRuleAbility } from '../../hooks/useAbilities';
import { fetchPromAndRulerRulesAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME, getRulesSourceName } from '../../utils/datasource';
import { createViewLink } from '../../utils/misc';
import * as ruleId from '../../utils/rule-id';
import { isGrafanaOrDataSourceRecordingRule, isGrafanaRulerRule } from '../../utils/rules';
import { createUrl } from '../../utils/url';

import { RedirectToCloneRule } from './CloneRule';

export const matchesWidth = (width: number) => window.matchMedia(`(max-width: ${width}px)`).matches;

interface Props {
  rule: CombinedRule;
  rulesSource: RulesSource;
  /**
   * Should we show the buttons in a "compact" state?
   * i.e. without text and using smaller button sizes
   */
  compact?: boolean;
  showViewButton?: boolean;
  showCopyLinkButton?: boolean;
}

/**
 * **Action** buttons to show for an alert rule - e.g. "View", "Edit", "More..."
 */
export const RuleActionsButtons = ({ compact, showViewButton, showCopyLinkButton, rule, rulesSource }: Props) => {
  const dispatch = useDispatch();
  const location = useLocation();
  const style = useStyles2(getStyles);

  const redirectToListView = compact ? false : true;
  const [deleteModal, showDeleteModal] = useDeleteModal(redirectToListView);

  const [showSilenceDrawer, setShowSilenceDrawer] = useState<boolean>(false);

  const [redirectToClone, setRedirectToClone] = useState<
    { identifier: RuleIdentifier; isProvisioned: boolean } | undefined
  >(undefined);

  const { namespace, group, rulerRule } = rule;
  const { hasActiveFilters } = useRulesFilter();

  const returnTo = location.pathname + location.search;

  const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);

  const [editRuleSupported, editRuleAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Update);

  const canEditRule = editRuleSupported && editRuleAllowed;

  const buttons: JSX.Element[] = [];

  const buttonClasses = cx({ [style.compactButton]: compact });
  const buttonSize = compact ? 'sm' : 'md';

  const sourceName = getRulesSourceName(rulesSource);

  const identifier = ruleId.fromCombinedRule(sourceName, rule);

  if (showViewButton) {
    buttons.push(
      <LinkButton
        tooltip={compact ? 'View' : undefined}
        tooltipPlacement="top"
        className={buttonClasses}
        title={'View'}
        size={buttonSize}
        key="view"
        variant="secondary"
        icon="eye"
        href={createViewLink(rulesSource, rule, returnTo)}
      >
        {!compact && 'View'}
      </LinkButton>
    );
  }

  if (rulerRule && canEditRule) {
    const identifier = ruleId.fromRulerRule(sourceName, namespace.name, group.name, rulerRule);

    const editURL = createUrl(`/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/edit`, {
      returnTo,
    });

    buttons.push(
      <LinkButton
        tooltip={compact ? 'Edit' : undefined}
        tooltipPlacement="top"
        title={'Edit'}
        className={buttonClasses}
        size={buttonSize}
        key="edit"
        variant="secondary"
        icon="pen"
        href={editURL}
      >
        {!compact && 'Edit'}
      </LinkButton>
    );
  }

  return (
    <Stack gap={1}>
      {buttons}
      <AlertRuleMenu
        buttonSize={buttonSize}
        rule={rule}
        identifier={identifier}
        showCopyLinkButton={showCopyLinkButton}
        handleDelete={() => showDeleteModal(rule)}
        handleSilence={() => setShowSilenceDrawer(true)}
        handleDuplicateRule={() => setRedirectToClone({ identifier, isProvisioned })}
        onPauseChange={() => {
          // Uses INSTANCES_DISPLAY_LIMIT + 1 here as exporting LIMIT_ALERTS from RuleList has the side effect
          // of breaking some unrelated tests in Policy.test.tsx due to mocking approach
          const limitAlerts = hasActiveFilters ? undefined : INSTANCES_DISPLAY_LIMIT + 1;
          // Trigger a re-fetch of the rules table
          // TODO: Migrate rules table functionality to RTK Query, so we instead rely
          // on tag invalidation (or optimistic cache updates) for this
          dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME, limitAlerts }));
        }}
      />
      {deleteModal}
      {isGrafanaRulerRule(rule.rulerRule) &&
        !isGrafanaOrDataSourceRecordingRule(rule.rulerRule) &&
        showSilenceDrawer && (
          <AlertmanagerProvider accessType="instance">
            <SilenceGrafanaRuleDrawer rulerRule={rule.rulerRule} onClose={() => setShowSilenceDrawer(false)} />
          </AlertmanagerProvider>
        )}
      {redirectToClone?.identifier && (
        <RedirectToCloneRule
          identifier={redirectToClone.identifier}
          isProvisioned={redirectToClone.isProvisioned}
          onDismiss={() => setRedirectToClone(undefined)}
        />
      )}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  compactButton: css({
    padding: `0 ${theme.spacing(2)}`,
  }),
});

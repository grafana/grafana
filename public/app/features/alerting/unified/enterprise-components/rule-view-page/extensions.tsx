import { css } from '@emotion/css';

import { FeatureState, type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FeatureBadge, useStyles2 } from '@grafana/ui';

import { useAlertRule } from '../../components/rule-viewer/RuleContext';
import { useEnrichmentAbilityState } from '../../hooks/abilities/otherAbilities';
import { EnrichmentAction } from '../../hooks/abilities/types';
import { rulerRuleType } from '../../utils/rules';

type SetActiveTab = (tab: string) => void;

type RuleViewTabBuilderArgs = {
  activeTab: string;
  setActiveTab: SetActiveTab;
};

/**
 * A tab builder receives the current tab state AND a set of pre-resolved ability
 * flags. Abilities are resolved by the surrounding hook so that this function is
 * a plain function — not a hook — making it safe to store in a registry and call
 * outside of React's render phase.
 */
type TabAbilityFlags = {
  canReadEnrichments: boolean;
};

type RuleViewTabBuilder = (args: RuleViewTabBuilderArgs, abilities: TabAbilityFlags) => NavModelItem | null;
type RuleViewTabBuilderConfig = {
  filterOnlyGrafanaAlertRules: boolean;
  ruleViewTabBuilder: RuleViewTabBuilder;
};

const ruleViewTabBuilders: RuleViewTabBuilderConfig[] = [];

function registerRuleViewTab(builder: RuleViewTabBuilder) {
  ruleViewTabBuilders.push({
    filterOnlyGrafanaAlertRules: true,
    ruleViewTabBuilder: builder,
  });
}

/**
 * Returns the list of extension tabs for the rule view page.
 * Ability flags must be resolved by the caller (a hook) and passed in — this
 * function is intentionally a plain function so it can be called in tests and
 * non-hook contexts without triggering React hook violations.
 */
export function getRuleViewExtensionTabs(
  args: RuleViewTabBuilderArgs,
  isGrafanaAlertRule: boolean,
  abilities: TabAbilityFlags
): NavModelItem[] {
  return ruleViewTabBuilders
    .filter((config) => {
      if (config.filterOnlyGrafanaAlertRules && !isGrafanaAlertRule) {
        return false;
      }
      return true;
    })
    .map((config) => config.ruleViewTabBuilder(args, abilities))
    .filter((item): item is NavModelItem => item !== null);
}

/**
 * Hook wrapper around {@link getRuleViewExtensionTabs}. Resolves all ability
 * flags here so the tab builders themselves are plain functions.
 */
export function useRuleViewExtensionTabs(args: RuleViewTabBuilderArgs): NavModelItem[] {
  const { rule } = useAlertRule();
  const isGrafanaAlertRule = rulerRuleType.grafana.alertingRule(rule.rulerRule);

  // Resolve ability flags here — not inside the builder callbacks — so that
  // hook rules are never violated by stored callbacks.
  const { granted: canReadEnrichments } = useEnrichmentAbilityState(EnrichmentAction.Read);

  return getRuleViewExtensionTabs(args, isGrafanaAlertRule, { canReadEnrichments });
}

export function addEnrichmentSection() {
  registerRuleViewTab(({ activeTab, setActiveTab }, { canReadEnrichments }) => {
    if (!canReadEnrichments) {
      return null;
    }

    const tabId = 'enrichment';
    return {
      text: t('alerting.use-page-nav.page-nav.text.enrichment', 'Alert enrichment'),
      active: activeTab === tabId,
      onClick: () => setActiveTab(tabId),
      tabSuffix: () => <EnrichmentTabSuffix />,
    };
  });
}

// ONLY FOR TESTS: resets the registered tabs between tests
export function __clearRuleViewTabsForTests() {
  ruleViewTabBuilders.splice(0, ruleViewTabBuilders.length);
}

function getStyles() {
  return {
    tabSuffix: css({
      marginLeft: 8,
    }),
  };
}

function EnrichmentTabSuffix() {
  const styles = useStyles2(getStyles);
  return (
    <span className={styles.tabSuffix}>
      <FeatureBadge featureState={FeatureState.new} />
    </span>
  );
}

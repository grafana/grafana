import { css } from '@emotion/css';

import { FeatureState, NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FeatureBadge, useStyles2 } from '@grafana/ui';

import { useAlertRule } from '../../components/rule-viewer/RuleContext';
import { EnrichmentAction, useEnrichmentAbility } from '../../hooks/useAbilities';
import { rulerRuleType } from '../../utils/rules';

type SetActiveTab = (tab: string) => void;

type RuleViewTabBuilderArgs = {
  activeTab: string;
  setActiveTab: SetActiveTab;
};

type RuleViewTabBuilder = (args: RuleViewTabBuilderArgs) => NavModelItem;
type RuleViewTabBuilderConfig = {
  filterOnlyGrafanaAlertRules: boolean;
  requiresEnrichmentReadPermission?: boolean;
  ruleViewTabBuilder: RuleViewTabBuilder;
};

const ruleViewTabBuilders: RuleViewTabBuilderConfig[] = [];

function registerRuleViewTab(builder: RuleViewTabBuilder, requiresEnrichmentReadPermission = false) {
  ruleViewTabBuilders.push({
    filterOnlyGrafanaAlertRules: true,
    requiresEnrichmentReadPermission,
    ruleViewTabBuilder: builder,
  });
}

export function useRuleViewExtensionTabs(args: RuleViewTabBuilderArgs): NavModelItem[] {
  const { rule } = useAlertRule();
  const isGrafanaAlertRule = rulerRuleType.grafana.alertingRule(rule.rulerRule);
  const [, canReadEnrichments] = useEnrichmentAbility(EnrichmentAction.Read);

  return ruleViewTabBuilders
    .filter((config) => {
      // Check if rule type matches requirement
      if (config.filterOnlyGrafanaAlertRules && !isGrafanaAlertRule) {
        return false;
      }
      // Check if enrichment read permission is required and granted
      if (config.requiresEnrichmentReadPermission && !canReadEnrichments) {
        return false;
      }
      return true;
    })
    .map((config) => config.ruleViewTabBuilder(args));
}

export function addEnrichmentSection() {
  registerRuleViewTab(
    ({ activeTab, setActiveTab }) => {
      const tabId = 'enrichment';
      return {
        text: t('alerting.use-page-nav.page-nav.text.enrichment', 'Alert enrichment'),
        active: activeTab === tabId,
        onClick: () => setActiveTab(tabId),
        tabSuffix: () => <EnrichmentTabSuffix />,
      };
    },
    true // Requires enrichment read permission
  );
}

// ONLY FOR TESTS: resets the registered tabs between tests
export function __clearRuleViewTabsForTests() {
  ruleViewTabBuilders.splice(0, ruleViewTabBuilders.length);
}

// ONLY FOR TESTS: non-hook version for testing
export function getRuleViewExtensionTabs(
  args: RuleViewTabBuilderArgs,
  isGrafanaAlertRule: boolean,
  canReadEnrichments = true
): NavModelItem[] {
  return ruleViewTabBuilders
    .filter((config) => {
      // Check if rule type matches requirement
      if (config.filterOnlyGrafanaAlertRules && !isGrafanaAlertRule) {
        return false;
      }
      // Check if enrichment read permission is required and granted
      if (config.requiresEnrichmentReadPermission && !canReadEnrichments) {
        return false;
      }
      return true;
    })
    .map((config) => config.ruleViewTabBuilder(args));
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

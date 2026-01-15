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

type RuleViewTabBuilder = (args: RuleViewTabBuilderArgs) => NavModelItem | null;
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

export function getRuleViewExtensionTabs(args: RuleViewTabBuilderArgs, isGrafanaAlertRule: boolean): NavModelItem[] {
  return ruleViewTabBuilders
    .filter((config) => {
      // Check if rule type matches requirement
      if (config.filterOnlyGrafanaAlertRules && !isGrafanaAlertRule) {
        return false;
      }
      return true;
    })
    .map((config) => config.ruleViewTabBuilder(args))
    .filter((item): item is NavModelItem => item !== null);
}

export function useRuleViewExtensionTabs(args: RuleViewTabBuilderArgs): NavModelItem[] {
  const { rule } = useAlertRule();
  const isGrafanaAlertRule = rulerRuleType.grafana.alertingRule(rule.rulerRule);

  return getRuleViewExtensionTabs(args, isGrafanaAlertRule);
}

export function addEnrichmentSection() {
  registerRuleViewTab(({ activeTab, setActiveTab }) => {
    const [, canReadEnrichments] = useEnrichmentAbility(EnrichmentAction.Read);

    // Return null if user doesn't have permission (will be filtered out)
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

import { css } from '@emotion/css';

import { FeatureState, NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FeatureBadge, useStyles2 } from '@grafana/ui';

type SetActiveTab = (tab: string) => void;

type RuleViewTabBuilderArgs = {
  activeTab: string;
  setActiveTab: SetActiveTab;
};

type RuleViewTabBuilder = (args: RuleViewTabBuilderArgs) => NavModelItem;

const ruleViewTabBuilders: RuleViewTabBuilder[] = [];

export function registerRuleViewTab(builder: RuleViewTabBuilder) {
  ruleViewTabBuilders.push(builder);
}

export function getRuleViewExtensionTabs(args: RuleViewTabBuilderArgs): NavModelItem[] {
  return ruleViewTabBuilders.map((builder) => builder(args));
}

export function addEnrichmentSection() {
  registerRuleViewTab(({ activeTab, setActiveTab }) => {
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

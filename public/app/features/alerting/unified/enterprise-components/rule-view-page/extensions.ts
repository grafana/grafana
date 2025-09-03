import React from 'react';

import { FeatureState, NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FeatureBadge } from '@grafana/ui';

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
      tabSuffix: () =>
        React.createElement(
          'span',
          { style: { marginLeft: 8 } },
          React.createElement(FeatureBadge, { featureState: FeatureState.new })
        ),
    };
  });
}

// ONLY FOR TESTS: resets the registered tabs between tests
export function __clearRuleViewTabsForTests() {
  ruleViewTabBuilders.splice(0, ruleViewTabBuilders.length);
}

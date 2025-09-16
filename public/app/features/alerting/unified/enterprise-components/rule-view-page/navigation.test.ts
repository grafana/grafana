import { beforeEach, describe, expect, it } from '@jest/globals';

import { __clearRuleViewTabsForTests, addEnrichmentSection, getRuleViewExtensionTabs } from './extensions';

describe('rule-view-page navigation', () => {
  beforeEach(() => {
    __clearRuleViewTabsForTests();
  });

  it('does not include Alert enrichment tab when not registered', () => {
    const tabs = getRuleViewExtensionTabs({ activeTab: 'query', setActiveTab: () => {} });
    const hasEnrichment = tabs.some((t) => t.text === 'Alert enrichment');
    expect(hasEnrichment).toBe(false);
  });

  it('includes Alert enrichment tab when registered (enterprise + toggle on)', () => {
    addEnrichmentSection();
    const tabs = getRuleViewExtensionTabs({ activeTab: 'query', setActiveTab: () => {} });
    const enrichment = tabs.find((t) => t.text === 'Alert enrichment');
    expect(enrichment).toBeTruthy();
    expect(enrichment!.active).toBe(false);
  });

  it('marks Alert enrichment tab active when selected', () => {
    addEnrichmentSection();
    const tabs = getRuleViewExtensionTabs({ activeTab: 'enrichment', setActiveTab: () => {} });
    const enrichment = tabs.find((t) => t.text === 'Alert enrichment');
    expect(enrichment).toBeTruthy();
    expect(enrichment!.active).toBe(true);
  });
});

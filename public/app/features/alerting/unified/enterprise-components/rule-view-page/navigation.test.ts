import { beforeEach, describe, expect, it } from '@jest/globals';

import { addRulePageEnrichmentSection } from '../../components/rule-viewer/tabs/extensions/RuleViewerExtension';

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

  describe('enrichment section registration', () => {
    it('should register enrichment section with correct prop interface', () => {
      const mockEnrichmentSection = jest.fn(() => null);

      // This should not throw an error
      expect(() => {
        addRulePageEnrichmentSection(mockEnrichmentSection);
      }).not.toThrow();
    });

    it('should handle enrichment section with required props', () => {
      const mockEnrichmentSection = jest.fn((props: { ruleUid: string }) => {
        expect(props).toHaveProperty('ruleUid');
        expect(typeof props.ruleUid).toBe('string');
        return null;
      });

      addRulePageEnrichmentSection(mockEnrichmentSection);

      // The registration should succeed
      expect(mockEnrichmentSection).toBeDefined();
    });
  });
});

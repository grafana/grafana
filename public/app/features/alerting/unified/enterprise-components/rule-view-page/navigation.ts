import { NavModelItem } from '@grafana/data';

import { useRuleViewExtensionTabs } from './extensions';

export function useRuleViewExtensionsNav(activeTab: string, setActiveTab: (tab: string) => void): NavModelItem[] {
  return useRuleViewExtensionTabs({ activeTab, setActiveTab });
}

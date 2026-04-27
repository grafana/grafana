import type { NavModelItem } from '@grafana/data/types';

import { useRuleViewExtensionTabs } from './extensions';

export function useRuleViewExtensionsNav(activeTab: string, setActiveTab: (tab: string) => void): NavModelItem[] {
  return useRuleViewExtensionTabs({ activeTab, setActiveTab });
}

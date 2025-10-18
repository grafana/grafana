import { NavModelItem } from '@grafana/data';

import { getRuleViewExtensionTabs } from './extensions';

export function useRuleViewExtensionsNav(activeTab: string, setActiveTab: (tab: string) => void): NavModelItem[] {
  return getRuleViewExtensionTabs({ activeTab, setActiveTab });
}

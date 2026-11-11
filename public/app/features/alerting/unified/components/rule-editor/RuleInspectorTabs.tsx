import { Tab, TabsBar } from '@grafana/ui';

export interface RuleInspectorTabsProps<T = string> {
  tabs: Array<{ label: string; value: T }>;
  activeTab: T;
  setActiveTab: (tab: T) => void;
}

export function RuleInspectorTabs<T extends string>({ tabs, activeTab, setActiveTab }: RuleInspectorTabsProps<T>) {
  return (
    <TabsBar>
      {tabs.map((tab, index) => {
        return (
          <Tab
            key={`${tab.value}-${index}`}
            label={tab.label}
            value={tab.value}
            onChangeTab={() => setActiveTab(tab.value)}
            active={activeTab === tab.value}
          />
        );
      })}
    </TabsBar>
  );
}

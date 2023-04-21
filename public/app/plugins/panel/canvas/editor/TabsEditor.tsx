import React, { useState } from 'react';

import { Tab, TabsBar } from '@grafana/ui/src';

import { InlineEditTabs } from '../types';

type Props = {
  onTabChange: (v: string) => void;
};

export const TabsEditor = ({ onTabChange }: Props) => {
  const [activeTab, setActiveTab] = useState<string>(InlineEditTabs.SelectedElement);

  const tabs = [
    { label: 'Selected Element', value: InlineEditTabs.SelectedElement },
    { label: 'Element Management', value: InlineEditTabs.ElementManagement },
  ];

  const onCurrentTabChange = (value: string) => {
    onTabChange(value);
    setActiveTab(value);
  };

  return (
    <>
      <TabsBar>
        {tabs.map((t, index) => (
          <Tab
            key={`${t.value}-${index}`}
            label={t.label}
            active={t.value === activeTab}
            onChangeTab={() => onCurrentTabChange(t.value!)}
          />
        ))}
      </TabsBar>
    </>
  );
};

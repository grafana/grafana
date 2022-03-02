import React, { FC, useState } from 'react';
import { CodeEditor, Drawer, Tab, TabsBar } from '@grafana/ui';
import { RuleFormValues } from '../../types/rule-form';
import { useFormContext } from 'react-hook-form';

interface Props {
  onClose: () => void;
}

const tabs = [{ label: 'Yaml', value: 'yaml' }];

export const RuleInspector: FC<Props> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('yaml');
  return (
    <Drawer
      title="Inspect Alert rule"
      subtitle={<RuleInspectorSubtitle setActiveTab={setActiveTab} activeTab={activeTab} />}
      onClose={onClose}
    >
      {activeTab === 'yaml' && <InspectorYamlTab />}
    </Drawer>
  );
};

interface SubtitleProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const RuleInspectorSubtitle: FC<SubtitleProps> = ({ activeTab, setActiveTab }) => {
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
};

const InspectorYamlTab = () => {
  const { getValues } = useFormContext<RuleFormValues>();

  return <CodeEditor language="yaml" />;
};

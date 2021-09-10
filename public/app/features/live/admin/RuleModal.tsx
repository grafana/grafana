import React, { useState } from 'react';
import { Modal, TabContent, TabsBar, Tab, CodeEditor } from '@grafana/ui';
import { Rule } from './types';

interface Props {
  rule: Rule;
  isOpen: boolean;
  onClose: () => void;
}

const tabs = [
  { label: 'converter', value: 'converter' },
  { label: 'processor', value: 'processor' },
  { label: 'output', value: 'output' },
];
const height = 500;

export const RuleModal: React.FC<Props> = ({ rule, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<string>('converter');

  return (
    <Modal isOpen={isOpen} title={rule.pattern} onDismiss={onClose} closeOnEscape>
      <TabsBar>
        {tabs.map((tab, index) => {
          return (
            <Tab
              key={index}
              label={tab.label}
              active={tab.value === activeTab}
              onChangeTab={() => {
                setActiveTab(tab.value);
              }}
            />
          );
        })}
      </TabsBar>
      <TabContent>
        {activeTab === 'converter' && (
          <CodeEditor
            height={height}
            value={JSON.stringify(rule.settings.converter, null, '\t')}
            showLineNumbers={true}
            readOnly={true}
            language="json"
            showMiniMap={false}
          />
        )}
        {activeTab === 'processor' && (
          <CodeEditor
            height={height}
            value={JSON.stringify(rule.settings.processor, null, '\t')}
            showLineNumbers={true}
            readOnly={true}
            language="json"
            showMiniMap={false}
          />
        )}
        {activeTab === 'output' && (
          <CodeEditor
            height={height}
            value={JSON.stringify(rule.settings.output, null, '\t')}
            showLineNumbers={true}
            readOnly={true}
            language="json"
            showMiniMap={false}
          />
        )}
      </TabContent>
    </Modal>
  );
};

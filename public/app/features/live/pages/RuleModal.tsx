import React, { useState } from 'react';
import { Modal, TabContent, TabsBar, Tab, CodeEditor } from '@grafana/ui';
import { Rule } from './types';

interface Props {
  rule: Rule;
  isOpen: boolean;
  onClose: () => void;
}

const tabs = [
  { label: 'Converter', value: 'converter' },
  { label: 'Processor', value: 'processor' },
  { label: 'Output', value: 'output' },
];
const height = 600;

export const RuleModal: React.FC<Props> = (props) => {
  const { rule, isOpen, onClose } = props;
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
        {activeTab === 'converter' && <ConverterEditor {...props} />}
        {activeTab === 'processor' && <ProcessorEditor {...props} />}
        {activeTab === 'output' && <OutputEditor {...props} />}
      </TabContent>
    </Modal>
  );
};

export const ConverterEditor: React.FC<Props> = ({ rule }) => {
  const { converter } = rule.settings;
  if (!converter) {
    return <div>No converter defined</div>;
  }

  return (
    <CodeEditor
      height={height}
      value={JSON.stringify(converter, null, '\t')}
      showLineNumbers={true}
      readOnly={true}
      language="json"
      showMiniMap={false}
    />
  );
};

export const ProcessorEditor: React.FC<Props> = ({ rule }) => {
  const { processor } = rule.settings;
  if (!processor) {
    return <div>No processor defined</div>;
  }

  return (
    <CodeEditor
      height={height}
      value={JSON.stringify(processor, null, '\t')}
      showLineNumbers={true}
      readOnly={true}
      language="json"
      showMiniMap={false}
    />
  );
};

export const OutputEditor: React.FC<Props> = ({ rule }) => {
  const { output } = rule.settings;
  if (!output) {
    return <div>No output defined</div>;
  }

  return (
    <CodeEditor
      height={height}
      value={JSON.stringify(output, null, '\t')}
      showLineNumbers={true}
      readOnly={true}
      language="json"
      showMiniMap={false}
    />
  );
};

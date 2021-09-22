import React, { useState } from 'react';
import { Modal, TabContent, TabsBar, Tab, CodeEditor, Button, Alert } from '@grafana/ui';
import { Rule } from './types';
import { getBackendSrv } from '@grafana/runtime';
import { css } from '@emotion/css';

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
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const onSave = (text: string) => {
    getBackendSrv()
      .put(`api/live/channel-rules`, {
        ...rule,
        settings: {
          ...rule.settings,
          convertor: text,
        },
      })
      .then(() => setSuccess(true))
      .catch(() => setError(true));
  };

  const onRemoveAlert = () => setSuccess(false);
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
        {success && <Alert title="Saved successfully" severity="success" onRemove={onRemoveAlert} />}
        {error && <Alert title="Failed to save" severity="error" onRemove={onRemoveAlert} />}
        {activeTab === 'converter' && <ConverterEditor {...props} onSave={onSave} />}
        {activeTab === 'processor' && <ProcessorEditor {...props} />}
        {activeTab === 'output' && <OutputEditor {...props} />}
        <Button onClick={onSave}>Save</Button>
      </TabContent>
    </Modal>
  );
};

export const ConverterEditor: React.FC<Props> = ({ rule, onSave }) => {
  const { converter } = rule.settings;

  if (!converter) {
    return <div>Hello</div>;
  }

  return (
    <>
      <CodeEditor
        height={height}
        value={JSON.stringify(converter, null, '\t')}
        showLineNumbers={true}
        readOnly={false}
        language="json"
        showMiniMap={false}
        onSave={(text: string) => onSave(text)}
      />
    </>
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

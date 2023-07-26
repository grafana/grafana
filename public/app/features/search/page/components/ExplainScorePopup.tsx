import React, { useState } from 'react';

import { DataFrame } from '@grafana/data';
import { CodeEditor, Modal, ModalTabsHeader, TabContent } from '@grafana/ui';
import { DataHoverView } from 'app/features/visualization/data-hover/DataHoverView';

export interface Props {
  name: string;
  explain: {};
  frame: DataFrame;
  row: number;
}

const tabs = [
  { label: 'Score', value: 'score' },
  { label: 'Fields', value: 'fields' },
  { label: 'Allowed actions', value: 'allowed_actions' },
];

export function ExplainScorePopup({ name, explain, frame, row }: Props) {
  const [isOpen, setOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState('score');

  const modalHeader = (
    <ModalTabsHeader
      title={name}
      icon={'info'}
      tabs={tabs}
      activeTab={activeTab}
      onChangeTab={(t) => {
        setActiveTab(t.value);
      }}
    />
  );

  return (
    <Modal title={modalHeader} isOpen={isOpen} onDismiss={() => setOpen(false)} closeOnBackdropClick closeOnEscape>
      <TabContent>
        {activeTab === tabs[0].value && (
          <CodeEditor
            width="100%"
            height="70vh"
            language="json"
            showLineNumbers={false}
            showMiniMap={true}
            value={JSON.stringify(explain, null, 2)}
            readOnly={false}
          />
        )}
        {activeTab === tabs[1].value && (
          <div>
            <DataHoverView data={frame} rowIndex={row} />
          </div>
        )}
        {activeTab === tabs[2].value && (
          <CodeEditor
            width="100%"
            height="70vh"
            language="json"
            showLineNumbers={false}
            showMiniMap={false}
            value={(() => {
              const allowedActions = frame.fields.find((f) => f.name === 'allowed_actions')?.values?.[row];
              const dsUids = frame.fields.find((f) => f.name === 'ds_uid')?.values?.[row];
              return JSON.stringify({ dsUids: dsUids ?? [], allowedActions: allowedActions ?? [] }, null, 2);
            })()}
            readOnly={false}
          />
        )}
      </TabContent>
    </Modal>
  );
}

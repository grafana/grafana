import React, { useState } from 'react';

import { DataFrame } from '@grafana/data';
import { CodeEditor, Modal, ModalTabsHeader, TabContent } from '@grafana/ui';
import { DataHoverView } from 'app/plugins/panel/geomap/components/DataHoverView';

export interface Props {
  name: string;
  explain: {};
  frame: DataFrame;
  row: number;
}

const tabs = [
  { label: 'Score', value: 'score' },
  { label: 'Fields', value: 'fields' },
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
      </TabContent>
    </Modal>
  );
}

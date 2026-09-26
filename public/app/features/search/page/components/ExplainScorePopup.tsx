import { useState } from 'react';

import { type DataFrame } from '@grafana/data';
import { Modal, ModalTabsHeader, TabContent } from '@grafana/ui';
import { CodeMirrorEditor } from '@grafana/ui/unstable';
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
      tabs={tabs}
      activeTab={activeTab}
      onChangeTab={(t) => {
        setActiveTab(t.value);
      }}
    />
  );

  return (
    <Modal
      ariaLabel={name}
      title={modalHeader}
      isOpen={isOpen}
      onDismiss={() => setOpen(false)}
      closeOnBackdropClick
      closeOnEscape
    >
      <TabContent>
        {activeTab === tabs[0].value && (
          <JsonEditor label={tabs[0].label} initialValue={JSON.stringify(explain, null, 2)} />
        )}
        {activeTab === tabs[1].value && (
          <div>
            <DataHoverView data={frame} rowIndex={row} />
          </div>
        )}
        {activeTab === tabs[2].value && (
          <JsonEditor
            label={tabs[2].label}
            initialValue={(() => {
              const allowedActions = frame.fields.find((f) => f.name === 'allowed_actions')?.values?.[row];
              const dsUids = frame.fields.find((f) => f.name === 'ds_uid')?.values?.[row];
              return JSON.stringify({ dsUids: dsUids ?? [], allowedActions: allowedActions ?? [] }, null, 2);
            })()}
          />
        )}
      </TabContent>
    </Modal>
  );
}

function JsonEditor({ initialValue, label }: { initialValue: string; label: string }) {
  const [value, setValue] = useState(initialValue);

  return (
    <CodeMirrorEditor
      aria-label={label}
      height="70vh"
      language="json"
      basicSetup={{ lineNumbers: false }}
      value={value}
      onChange={setValue}
      readOnly={false}
    />
  );
}

import React, { useState } from 'react';

import { DataFrame } from '@grafana/data';
import { CodeEditor, TabsBar, Tab, Modal } from '@grafana/ui';
import { DataHoverView } from 'app/plugins/panel/geomap/components/DataHoverView';

export interface Props {
  name: string;
  explain: {};
  frame: DataFrame;
  row: number;
}

export function ExplainScorePopup({ name, explain, frame, row }: Props): JSX.Element {
  const [isOpen, setOpen] = useState<boolean>(true);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  return (
    <Modal title={name} isOpen={isOpen} onDismiss={() => setOpen(false)} closeOnBackdropClick closeOnEscape>
      <TabsBar>
        <Tab label="Score" active={!showDetails} onChangeTab={() => setShowDetails(false)} />
        <Tab label="Details" active={showDetails} onChangeTab={() => setShowDetails(true)} />
      </TabsBar>
      {showDetails && (
        <div>
          <DataHoverView data={frame} rowIndex={row} />
        </div>
      )}
      {!showDetails && (
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
    </Modal>
  );
}

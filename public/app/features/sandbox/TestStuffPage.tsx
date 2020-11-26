import React, { FC, useState } from 'react';
import { PanelModel } from '../dashboard/state';
import { QueriesTab } from '../query/components/QueriesTab';

interface State {
  panel: PanelModel;
}

export const TestStuffPage: FC = () => {
  const [state] = useState<State>(getDefaultState());

  return (
    <div style={{ padding: '50px', height: '100%', flexGrow: 1 }} className="page-scrollbar-wrapper">
      <h2>Hello</h2>

      <QueriesTab panel={state.panel} />
    </div>
  );
};

export function getDefaultState(): State {
  const panel = new PanelModel({
    datasource: 'gdev-testdata',
    id: 10,
    targets: [],
  });

  return {
    panel,
  };
}

export default TestStuffPage;

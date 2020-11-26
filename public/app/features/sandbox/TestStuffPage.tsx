import React, { FC, memo, useLayoutEffect, useState } from 'react';
import { PanelModel } from '../dashboard/state';

interface State {
  panel: PanelModel;
}

export const TestStuffPage: FC = () => {
  const [state, setState] = useState<State>();

  return (
    <div style={{ padding: '50px' }}>
      <h2>Hello</h2>
    </div>
  );
};

export function getDefaultState(): State {
  const panel = new PanelModel({});
}

export default TestStuffPage;

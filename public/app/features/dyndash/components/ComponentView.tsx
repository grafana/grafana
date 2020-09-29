import React from 'react';
import { FC } from 'react';
import { ComponentPanel } from '../models';

interface Props {
  panel: ComponentPanel;
}

export const ComponentView: FC<Props> = React.memo(({ panel }) => {
  return (
    <div className="panel-container">
      <panel.component />
    </div>
  );
});

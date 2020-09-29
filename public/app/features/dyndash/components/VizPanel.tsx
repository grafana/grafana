import React from 'react';
import { FC } from 'react';
import { VizPanel } from '../models';

interface Props {
  panel: VizPanel;
}
export const SceneVizView: FC<Props> = React.memo(({ panel }) => {
  console.log('render panel');
  return (
    <div className="panel-container">
      <div className="panel-header">
        <div className="panel-title">
          <div className="panel-title-text">{panel.title}</div>
        </div>
      </div>
    </div>
  );
});

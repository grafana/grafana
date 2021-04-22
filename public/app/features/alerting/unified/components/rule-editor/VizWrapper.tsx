import React, { FC, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { PanelData } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { HorizontalGroup, RadioButtonGroup } from '@grafana/ui';

interface Props {
  data: PanelData;
}

const vizOptions = [
  { value: 'timeseries', label: 'Graph' },
  { value: 'table', label: 'Table' },
  { value: 'stat', label: 'Single stat' },
];

export const VizWrapper: FC<Props> = ({ data }) => {
  const [pluginId, changePluginId] = useState<string>('timeseries');

  return (
    <div>
      <AutoSizer style={{ width: '50%', height: '50%' }}>
        {({ width, height }) => {
          return (
            <PanelRenderer
              height={height}
              width={width}
              data={data}
              pluginId={pluginId}
              title="title"
              onOptionsChange={() => {}}
            />
          );
        }}
      </AutoSizer>
      <div>
        <HorizontalGroup>
          <RadioButtonGroup options={vizOptions} value={pluginId} onChange={changePluginId} />
        </HorizontalGroup>
      </div>
    </div>
  );
};

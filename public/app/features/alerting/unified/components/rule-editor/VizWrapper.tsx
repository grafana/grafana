import React, { FC, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { PanelData, VizOrientation } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import {
  HorizontalGroup,
  LegendDisplayMode,
  RadioButtonGroup,
  SingleStatBaseOptions,
  TooltipDisplayMode,
} from '@grafana/ui';
import { Options } from 'app/plugins/panel/timeseries/types';

interface Props {
  data: PanelData;
  defaultPanel?: 'timeseries' | 'table' | 'stat';
}

export const VizWrapper: FC<Props> = ({ data, defaultPanel = 'timeseries' }) => {
  const [pluginId, changePluginId] = useState<string>(defaultPanel);
  const options = getOptionsForPanelPlugin(pluginId);

  if (!options) {
    return null;
  }
  return (
    <div style={{ height: '200px', width: '100%' }}>
      <AutoSizer>
        {({ width, height }) => {
          return (
            <PanelRenderer
              height={height}
              width={width}
              data={data}
              pluginId={pluginId}
              title="title"
              onOptionsChange={() => {}}
              options={options}
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

const getOptionsForPanelPlugin = (panelPlugin: string) => {
  switch (panelPlugin) {
    case 'stat':
      return singleStatOptions;
    case 'table':
      return tableOptions;
    case 'timeseries':
      return timeSeriesOptions;
    default:
      return undefined;
  }
};

const vizOptions = [
  { value: 'timeseries', label: 'Graph' },
  { value: 'table', label: 'Table' },
  { value: 'stat', label: 'Single stat' },
];

const timeSeriesOptions: Options = {
  legend: {
    displayMode: LegendDisplayMode.List,
    placement: 'bottom',
    calcs: [],
  },
  tooltipOptions: {
    mode: TooltipDisplayMode.Single,
  },
};

const tableOptions = {};
const singleStatOptions: SingleStatBaseOptions = {
  reduceOptions: {
    calcs: [],
  },
  orientation: VizOrientation.Auto,
  text: undefined,
};

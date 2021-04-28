import React, { FC, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { css } from '@emotion/css';
import { GrafanaTheme, PanelData, VizOrientation } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import {
  HorizontalGroup,
  LegendDisplayMode,
  RadioButtonGroup,
  SingleStatBaseOptions,
  TooltipDisplayMode,
  useStyles,
} from '@grafana/ui';
import { Options } from 'app/plugins/panel/timeseries/types';

interface Props {
  data: PanelData;
  defaultPanel?: 'timeseries' | 'table' | 'stat';
}

export const VizWrapper: FC<Props> = ({ data, defaultPanel }) => {
  const [pluginId, changePluginId] = useState<string>(defaultPanel ?? 'timeseries');
  const options = { ...getOptionsForPanelPlugin(pluginId) };
  const styles = useStyles(getStyles);

  if (!options || !data) {
    return null;
  }

  console.log(pluginId);
  console.log(options);

  return (
    <div>
      <HorizontalGroup>
        <RadioButtonGroup options={vizOptions} value={pluginId} onChange={changePluginId} />
      </HorizontalGroup>
      <div style={{ height: '200px', width: '100%', position: 'relative' }}>
        <AutoSizer style={{ width: '100%', height: '100%' }}>
          {({ width, height }) => {
            if (height === 0 || width === 0) {
              return null;
            }

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

const tableOptions = {
  frameIndex: 0,
  showHeader: true,
};
const singleStatOptions: SingleStatBaseOptions = {
  reduceOptions: {
    calcs: [],
  },
  orientation: VizOrientation.Auto,
  text: undefined,
};

const getStyles = (theme: GrafanaTheme) => ({
  buttonGroup: css`
    margin-bottom: ${theme.spacing.md};
  `,
});

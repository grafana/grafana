import React, { FC, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { css } from '@emotion/css';
import { GrafanaTheme, PanelData, VizOrientation } from '@grafana/data';
import { config, PanelRenderer } from '@grafana/runtime';
import { LegendDisplayMode, SingleStatBaseOptions, TooltipDisplayMode, RadioButtonGroup, useStyles } from '@grafana/ui';

interface Props {
  data: PanelData;
  defaultPanel?: 'timeseries' | 'table' | 'stat';
}

export const VizWrapper: FC<Props> = ({ data, defaultPanel }) => {
  const [pluginId, changePluginId] = useState<string>(defaultPanel ?? 'timeseries');
  const options = { ...getOptionsForPanelPlugin(pluginId) };
  const styles = useStyles(getStyles);
  const panels = Object.values(config.panels)
    .filter((p) => p.id === 'timeseries' || p.id === 'table' || p.id === 'stat')
    .map((panel) => ({ value: panel.id, label: panel.name, imgUrl: panel.info.logos.small }));

  if (!options || !data) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <RadioButtonGroup options={panels} value={pluginId} onChange={changePluginId} />
      </div>
      <div style={{ height: '200px', width: '100%' }}>
        <AutoSizer style={{ width: '100%', height: '100%' }}>
          {({ width, height }) => {
            if (width === 0 || height === 0) {
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

const timeSeriesOptions = {
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
  wrapper: css`
    margin-left: ${theme.spacing.lg};
  `,
  buttonGroup: css`
    margin-bottom: ${theme.spacing.md};
  `,
});

import React, { FC, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { css } from '@emotion/css';
import { GrafanaTheme2, PanelData, VizOrientation } from '@grafana/data';
import { config, PanelRenderer } from '@grafana/runtime';
import {
  LegendDisplayMode,
  SingleStatBaseOptions,
  TooltipDisplayMode,
  RadioButtonGroup,
  useStyles2,
} from '@grafana/ui';

const TIMESERIES = 'timeseries';
const TABLE = 'table';
const STAT = 'stat';

interface Props {
  data: PanelData;
  defaultPanel?: 'timeseries' | 'table' | 'stat';
}

export const VizWrapper: FC<Props> = ({ data, defaultPanel }) => {
  const [pluginId, changePluginId] = useState<string>(defaultPanel ?? TIMESERIES);
  const options = { ...getOptionsForPanelPlugin(pluginId) };
  const styles = useStyles2(getStyles);
  const panels = getSupportedPanels();

  if (!options || !data) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.buttonGroup}>
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

const getSupportedPanels = () => {
  return Object.values(config.panels)
    .filter((p) => p.id === TIMESERIES || p.id === TABLE || p.id === STAT)
    .map((panel) => ({ value: panel.id, label: panel.name, imgUrl: panel.info.logos.small }));
};

const getOptionsForPanelPlugin = (panelPlugin: string) => {
  switch (panelPlugin) {
    case STAT:
      return singleStatOptions;
    case TABLE:
      return tableOptions;
    case TIMESERIES:
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

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    padding: 0 ${theme.spacing(2)};
  `,
  buttonGroup: css`
    display: flex;
    justify-content: flex-end;
  `,
});

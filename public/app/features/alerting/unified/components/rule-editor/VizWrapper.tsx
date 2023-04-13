import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { FieldConfigSource, GrafanaTheme2, isTimeSeriesFrames, PanelData, ThresholdsConfig } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { GraphFieldConfig, GraphTresholdsStyleMode } from '@grafana/schema';
import { PanelContext, PanelContextProvider, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { PanelOptions } from 'app/plugins/panel/table/panelcfg.gen';

import { useVizHeight } from '../../hooks/useVizHeight';
import { TIMESERIES, STAT } from '../../utils/constants';
import { PanelPluginsButtonGroup, SupportedPanelPlugins } from '../PanelPluginsButtonGroup';

interface Props {
  data: PanelData;
  thresholds?: ThresholdsConfig;
  thresholdsType?: GraphTresholdsStyleMode;
  onThresholdsChange?: (thresholds: ThresholdsConfig) => void;
}

type PanelFieldConfig = FieldConfigSource<GraphFieldConfig>;

export const VizWrapper = ({ data, thresholds, thresholdsType = GraphTresholdsStyleMode.Line }: Props) => {
  // make an educated guess about what visualisation we should show by default
  const defaultPluginId = getBestMatchingVisualization(data);
  const [pluginId, changePluginId] = useState<SupportedPanelPlugins>(defaultPluginId);
  const [options, setOptions] = useState<PanelOptions>({
    frameIndex: 0,
    showHeader: true,
  });
  const vizHeight = useVizHeight(data, pluginId, options.frameIndex);
  const styles = useStyles2(getStyles(vizHeight));

  const [fieldConfig, setFieldConfig] = useState<PanelFieldConfig>(defaultFieldConfig(data, thresholds));

  // if new data is received, make a new visualization guess
  useEffect(() => {
    const pluginId = getBestMatchingVisualization(data);
    changePluginId(pluginId);
  }, [data]);

  useEffect(() => {
    setFieldConfig((fieldConfig) => ({
      ...fieldConfig,
      defaults: {
        ...fieldConfig.defaults,
        thresholds: thresholds,
        unit: defaultUnit(data),
        custom: {
          ...fieldConfig.defaults.custom,
          thresholdsStyle: {
            mode: thresholdsType,
          },
        },
      },
    }));
  }, [thresholds, setFieldConfig, data, thresholdsType]);

  const context: PanelContext = useMemo(
    () => ({
      eventBus: appEvents,
      canEditThresholds: false,
      showThresholds: true,
    }),
    []
  );

  if (!options || !data) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.buttonGroup}>
        <PanelPluginsButtonGroup onChange={changePluginId} value={pluginId} />
      </div>
      <AutoSizer>
        {({ width }) => {
          if (width === 0) {
            return null;
          }
          return (
            <div style={{ height: `${vizHeight}px`, width: `${width}px` }}>
              <PanelContextProvider value={context}>
                <PanelRenderer
                  height={vizHeight}
                  width={width}
                  data={data}
                  pluginId={pluginId}
                  title="title"
                  onOptionsChange={setOptions}
                  options={options}
                  fieldConfig={fieldConfig}
                />
              </PanelContextProvider>
            </div>
          );
        }}
      </AutoSizer>
    </div>
  );
};

function getBestMatchingVisualization(data: PanelData): SupportedPanelPlugins {
  const isTimeSeries = isTimeSeriesFrames(data.series);
  if (isTimeSeries) {
    return TIMESERIES;
  }

  return STAT;
}

const getStyles = (visHeight: number) => (theme: GrafanaTheme2) => ({
  wrapper: css`
    padding: 0 ${theme.spacing(2)};
    height: ${visHeight + theme.spacing.gridSize * 4}px;
  `,
  buttonGroup: css`
    display: flex;
    justify-content: flex-end;
  `,
});

function defaultUnit(data: PanelData): string | undefined {
  return data.series[0]?.fields.find((field) => field.type === 'number')?.config.unit;
}

function defaultFieldConfig(data: PanelData, thresholds?: ThresholdsConfig): PanelFieldConfig {
  if (!thresholds) {
    return { defaults: {}, overrides: [] };
  }

  return {
    defaults: {
      thresholds: thresholds,
      unit: defaultUnit(data),
      custom: {
        thresholdsStyle: {
          mode: GraphTresholdsStyleMode.Line,
        },
      },
    },
    overrides: [],
  };
}

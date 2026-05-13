import React, { type CSSProperties, useContext, useEffect, useState } from 'react';

import {
  getFrameDisplayName,
  type PanelData,
  type DataFrame,
  getFieldSeriesColor,
  type GrafanaTheme2,
  getFieldColorModeForField,
  FieldColorModeId,
  fieldColorModeRegistry,
} from '@grafana/data';
import { data } from '@grafana/flamegraph';
import { Trans } from '@grafana/i18n';
import {
  SceneDataNode,
  type VizPanel,
  type VizConfig,
  useSceneObjectState,
  type SceneDataProvider,
} from '@grafana/scenes';
import { SceneContext, SceneContextObject, VizGridLayout, VizPanel as VizPanelReact } from '@grafana/scenes-react';
import { Box, Spinner, useTheme2 } from '@grafana/ui';

import { bySeriesMode, getLabelFromMode, ViewPanelFanoutPane } from '../edit-pane/ViewPanelFanoutPane';
import { ViewPanelDataReceived } from '../edit-pane/events';
import { getDashboardSceneFor } from '../utils/utils';

interface SoloPanelWrapperProps {
  panel: VizPanel;
}

export function SoloPanelWrapper({ panel }: SoloPanelWrapperProps) {
  const dashboard = getDashboardSceneFor(panel);
  const { viewPanelFanout, editPane } = dashboard.useState();
  const [context, setContext] = useState<SceneContextObject | null>(null);
  const { $data } = useSceneObjectState(panel, { shouldActivateOrKeepAlive: true });
  const { data } = $data!.useState();

  useEffect(() => {
    if (!context && viewPanelFanout) {
      const newContext = new SceneContextObject();
      // @ts-expect-error
      panel.parent?.setState({ context: newContext });
      setContext(newContext);
    } else if (context && !viewPanelFanout) {
      // @ts-expect-error
      panel.parent?.setState({ context: null });
      setContext(null);
    }
  }, [viewPanelFanout, dashboard, panel, context]);

  useEffect(() => {
    if (!editPane.state.openPane) {
      editPane.openPane(new ViewPanelFanoutPane({ panelRef: panel.getRef() }));
    }
  }, [editPane, panel]);

  if (!context || !data || !viewPanelFanout) {
    return <panel.Component model={panel} />;
  }

  return (
    <SceneContext.Provider value={context}>
      <FanoutBySeries panel={panel} panelDataIn={data!} fanoutMode={viewPanelFanout} />
    </SceneContext.Provider>
  );
}

function FanoutBySeries({
  panel,
  panelDataIn,
  fanoutMode,
}: {
  panel: VizPanel;
  panelDataIn: PanelData;
  fanoutMode: string;
}) {
  const theme = useTheme2();

  const viz: VizConfig = {
    pluginId: panel.state.pluginId,
    pluginVersion: panel.state.pluginVersion ?? '0.0.0',
    options: {
      ...panel.state.options,
      // legend: {
      //   showLegend: false,
      // },
    },
    fieldConfig: panel.state.fieldConfig,
  };

  if (!panelDataIn) {
    return <Spinner />;
  }

  const groups = groupByDataByMode(panel, panelDataIn, fanoutMode, theme);

  const style: CSSProperties = {
    display: 'grid',
    flexGrow: 1,
    gridTemplateColumns: `repeat(auto-fit, minmax(100%, 1fr))`,
    gridAutoRows: `minmax(250px, auto)`,
    columnGap: theme.spacing(1),
    rowGap: theme.spacing(1),
    height: '100%',
  };

  return (
    <div style={style}>
      {groups.map((group, index) => {
        const dataNode = new SceneDataNode({
          data: {
            ...panelDataIn,
            series: group.frames,
          },
        });
        return <VizPanelReact key={index} title={group.name} viz={viz} dataProvider={dataNode} />;
      })}
    </div>
  );
}

interface SplitGroup {
  name: string;
  frames: DataFrame[];
}

export function groupByDataByMode(panel: VizPanel, data: PanelData, mode: string, theme: GrafanaTheme2): SplitGroup[] {
  const fieldConfig = panel.state.fieldConfig.defaults;

  if (mode === bySeriesMode) {
    return data.series.map((frame, index) => {
      const valueField = frame.fields.find((f) => f.type === 'number');
      if (valueField) {
        const mode =
          fieldColorModeRegistry.getIfExists(valueField.config.color?.mode) ??
          fieldColorModeRegistry.getIfExists(fieldConfig.color?.mode) ??
          fieldColorModeRegistry.get(FieldColorModeId.PaletteClassic);

        if (!mode.isByValue) {
          valueField.state = { ...valueField.state, seriesIndex: index };
          valueField.config = {
            ...valueField.config,
            color: {
              mode: FieldColorModeId.Fixed,
              fixedColor: mode.getCalculator(valueField, theme)(0, 0),
            },
          };
        }
      }

      return {
        name: getFrameDisplayName(frame, 0),
        frames: [frame],
      };
    });
  }

  const label = getLabelFromMode(mode);
  return groupDataFramesByLabel(data, label);
}

export function groupDataFramesByLabel(data: PanelData, label: string): SplitGroup[] {
  const groups: Record<string, DataFrame[]> = {};

  for (const frame of data.series) {
    const labelsField = frame.fields.find((f) => f.labels);
    const labels = labelsField?.labels ?? {};

    let groupKey = Object.entries(labels)
      .filter(([key]) => key === label)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    if (!groupKey) {
      groupKey = '__missing_label__';
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(frame);
  }

  return Object.entries(groups).map(([name, frames]) => ({
    name,
    frames,
  }));
}

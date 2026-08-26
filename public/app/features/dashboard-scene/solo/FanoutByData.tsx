import { useMemo } from 'react';

import {
  type PanelData,
  type DataFrame,
  type GrafanaTheme2,
  FieldColorModeId,
  getFrameDisplayName,
  fieldColorModeRegistry,
} from '@grafana/data';
import { SceneDataNode, type VizConfig, type VizPanel } from '@grafana/scenes';
import { VizPanel as VizPanelReact } from '@grafana/scenes-react';

import { type DataSplitGroup } from './FanoutPanel';
import { bySeriesMode, getLabelFromMode } from './ViewPanelSidePane';

export function FanoutDataGroup({
  group,
  viz,
  panelDataIn,
}: {
  group: DataSplitGroup;
  viz: VizConfig;
  panelDataIn: PanelData;
}) {
  const dataNode = useMemo(
    () => new SceneDataNode({ data: { ...panelDataIn, series: group.frames } }),
    [panelDataIn, group.frames]
  );

  return <VizPanelReact title={group.name} viz={viz} dataProvider={dataNode} />;
}

export function createDataGroups(
  panel: VizPanel,
  data: PanelData,
  mode: string | undefined,
  theme: GrafanaTheme2
): DataSplitGroup[] {
  const fieldConfig = panel.state.fieldConfig.defaults;

  if (!mode) {
    return [{ type: 'data', name: panel.state.title, frames: data.series }];
  }

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
        type: 'data' as const,
        name: getFrameDisplayName(frame, 0),
        frames: [frame],
      };
    });
  }

  const label = getLabelFromMode(mode);
  return groupDataFramesByLabel(data, label);
}

export function groupDataFramesByLabel(data: PanelData, label: string): DataSplitGroup[] {
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
    type: 'data',
    name,
    frames,
  }));
}

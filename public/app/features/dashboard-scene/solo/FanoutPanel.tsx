import { type CSSProperties } from 'react';

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
import { useTheme2, Spinner } from '@grafana/ui';

import { bySeriesMode, getLabelFromMode } from './ViewPanelSidePane';

export function FanoutPanel({
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
    },
    fieldConfig: panel.state.fieldConfig,
  };

  if (!panelDataIn) {
    return <Spinner />;
  }

  const groups = groupDataByMode(panel, panelDataIn, fanoutMode, theme);

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

function groupDataByMode(panel: VizPanel, data: PanelData, mode: string, theme: GrafanaTheme2): SplitGroup[] {
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

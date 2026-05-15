import { type CSSProperties, useEffect, useMemo, useState } from 'react';

import {
  getFrameDisplayName,
  type PanelData,
  type DataFrame,
  type GrafanaTheme2,
  FieldColorModeId,
  fieldColorModeRegistry,
} from '@grafana/data';
import { useFlagGrafanaViewPanelPane } from '@grafana/runtime/internal';
import { SceneDataNode, type VizPanel, type VizConfig, useSceneObjectState } from '@grafana/scenes';
import { SceneContext, SceneContextObject, VizPanel as VizPanelReact } from '@grafana/scenes-react';
import { useTheme2, Spinner } from '@grafana/ui';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { ToggleViewPanePaneEvent } from '../edit-pane/events';
import { getDashboardSceneFor } from '../utils/utils';

import { bySeriesMode, getLabelFromMode, ViewPanelSidePane } from './ViewPanelSidePane';

interface ViewPanelProps {
  panel: VizPanel;
}

export function ViewPanelWrapper({ panel }: ViewPanelProps) {
  const viewPanelPane = useFlagGrafanaViewPanelPane();
  if (!viewPanelPane || !panel.state.$data) {
    return <panel.Component model={panel} />;
  }

  return <ViewPanelWithPane panel={panel} />;
}

function ViewPanelWithPane({ panel }: ViewPanelProps) {
  const dashboard = getDashboardSceneFor(panel);
  const { editPane } = dashboard.useState();
  const { $data } = useSceneObjectState(panel, { shouldActivateOrKeepAlive: true });
  const { data } = $data!.useState();
  const context = usePanelSceneContextObject(panel);
  const isSmallScreen = !useMediaQueryMinWidth('sm');
  const viewPanelPane = useMemo(() => new ViewPanelSidePane({ panelRef: panel.getRef() }), [panel]);
  const { fanoutMode } = viewPanelPane.useState();

  // Open pane on mount
  useEffect(() => {
    if (!isSmallScreen && !editPane.state.openPane) {
      editPane.openPane(viewPanelPane);
    }
  }, [editPane, isSmallScreen, viewPanelPane]);

  // Handle manual toggling of the pane via the edit pane buttons
  // This is done via an event that sidebar pane button publishes as the ViewPanelSidePane instance & panel ref is only available from this component
  useEffect(() => {
    editPane.subscribeToEvent(ToggleViewPanePaneEvent, () => {
      if (editPane.state.openPane === viewPanelPane) {
        editPane.closePane();
      } else {
        editPane.openPane(viewPanelPane);
      }
    });
  }, [viewPanelPane, editPane]);

  if (!context || !data || !fanoutMode) {
    return <panel.Component model={panel} />;
  }

  return (
    <SceneContext.Provider value={context}>
      <FanoutBySeries panel={panel} panelDataIn={data!} fanoutMode={fanoutMode} />
    </SceneContext.Provider>
  );
}

function usePanelSceneContextObject(panel: VizPanel) {
  const [context, setContext] = useState<SceneContextObject | null>(null);

  /**
   * Attach SceneContextObject to the panel on mount for any dynamically rendered scenes-react panels
   */
  useEffect(() => {
    const newContext = new SceneContextObject();
    // @ts-expect-error
    panel.setState({ context: newContext });
    setContext(newContext);

    return () => {
      // @ts-expect-error
      panel.setState({ context: null });
      setContext(null);
    };
  }, [panel]);

  return context;
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

export function groupDataByMode(panel: VizPanel, data: PanelData, mode: string, theme: GrafanaTheme2): SplitGroup[] {
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

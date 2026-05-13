import { useEffect, useState } from 'react';

import { type GrafanaTheme2, type PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  type SceneComponentProps,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { Box, ScrollContainer, Sidebar, Text, RadioButtonDot, Field, Switch, Button } from '@grafana/ui';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

import { getDashboardSceneFor } from '../utils/utils';

export interface ViewPanelFanoutPaneState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
}

export class ViewPanelFanoutPane extends SceneObjectBase<ViewPanelFanoutPaneState> {
  public static Component = ViewPanelFanoutPaneRenderer;
  public getId() {
    return 'fanout' as const;
  }

  public onSetMode(value: string | undefined) {
    const dashboard = getDashboardSceneFor(this);
    dashboard.setState({ viewPanelFanout: value });
  }

  public onToggleLegend(show: boolean) {
    const panel = this.state.panelRef.resolve();
    panel.setState({
      //@ts-expect-error
      options: { ...panel.state.options, legend: { ...panel.state.options?.legend, showLegend: show } },
    });
  }
}

export function ViewPanelFanoutPaneRenderer({ model }: SceneComponentProps<ViewPanelFanoutPane>) {
  const dashboard = getDashboardSceneFor(model);
  const { viewPanel, viewPanelFanout } = dashboard.useState();
  const [labels, setLabels] = useState<string[] | undefined>(undefined);
  const panel = model.state.panelRef.resolve();

  useEffect(() => {
    if (!viewPanel) {
      dashboard.state.editPane.closePane();
    }

    const dataProvider = panel.state.$data!;

    const dataSub = dataProvider.subscribeToState((state) => {
      const labels = extractLabelsFromData(state.data);
      setLabels(labels);
    });

    setLabels(extractLabelsFromData(dataProvider.state.data));

    return () => dataSub.unsubscribe();
  }, [viewPanel, dashboard, model]);

  const modeValue = viewPanelFanout ?? '$__none__$';
  //@ts-expect-error
  const showLegend = panel.state.options?.legend?.showLegend ?? false;

  return (
    <Box display="flex" direction="column" flex={1} height="100%">
      <Sidebar.PaneHeader title={t('dashboard.sidebar.view-panel-fanout.pane-header', 'View panel')} />
      <ScrollContainer showScrollIndicators={true}>
        <Box padding={0} gap={2} display="flex" direction="column">
          <Box display="flex" direction="column" gap={0} padding={2} paddingBottom={0}>
            <Button
              variant="secondary"
              onClick={() => dashboard.setState({ viewPanel: undefined })}
              size="sm"
              fullWidth
            >
              Back to dashboard
            </Button>
          </Box>

          <OptionsPaneCategory title="Quick toggles" id="quick-toggles" isOpenDefault={true}>
            <Field label="Show legend" noMargin>
              <Switch value={showLegend} onChange={(e) => model.onToggleLegend(e.currentTarget.checked)} />
            </Field>
          </OptionsPaneCategory>
          <OptionsPaneCategory title="Fan-out by series or label" id="fanout" isOpenDefault={true}>
            <Box direction="column" gap={1} display="flex" paddingLeft={1}>
              <RadioButtonDot
                name="fanout"
                id="$__none__$"
                label="Disabled"
                checked={modeValue === '$__none__$'}
                onClick={() => model.onSetMode(undefined)}
              />
              <RadioButtonDot
                name="fanout"
                id={bySeriesMode}
                label="By series"
                checked={modeValue === bySeriesMode}
                onClick={() => model.onSetMode(bySeriesMode)}
              />
            </Box>
            <Box padding={1}>
              <Text variant="bodySmall" weight="medium">
                Labels
              </Text>
            </Box>
            <Box direction="column" gap={1} display="flex" paddingLeft={1}>
              {labels && labels.length === 0 && <Text variant="bodySmall">No labels found in the data</Text>}
              {labels?.map((label) => (
                <RadioButtonDot
                  key={label}
                  name="fanout"
                  id={getModeForLabel(label)}
                  label={label}
                  checked={modeValue === getModeForLabel(label)}
                  onClick={() => model.onSetMode(getModeForLabel(label))}
                />
              ))}
            </Box>
          </OptionsPaneCategory>
        </Box>
      </ScrollContainer>
    </Box>
  );
}

function extractLabelsFromData(panelData: PanelData | undefined): string[] {
  if (!panelData) {
    return [];
  }

  const labelSet = new Set<string>();
  panelData.series.forEach((s) => {
    s.fields.forEach((f) => {
      if (f.labels) {
        Object.keys(f.labels).forEach((label) => labelSet.add(label));
      }
    });
  });

  return Array.from(labelSet);
}

export function getModeForLabel(label: string) {
  return `$__by_label__${label}`;
}

export function getLabelFromMode(mode: string) {
  if (mode.startsWith('$__by_label__')) {
    return mode.replace('$__by_label__', '');
  }

  return 'unknown';
}

export const bySeriesMode = '$__by_series__$';

function getStyles(theme: GrafanaTheme2) {
  return {};
}

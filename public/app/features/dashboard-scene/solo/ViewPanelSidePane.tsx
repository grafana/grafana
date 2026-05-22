import { useEffect, useState } from 'react';

import { type GrafanaTheme2, type PanelData } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  type SceneComponentProps,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { StackingMode } from '@grafana/schema';
import {
  Box,
  ScrollContainer,
  Sidebar,
  Text,
  RadioButtonDot,
  Field,
  Switch,
  Button,
  getGraphFieldOptions,
  RadioButtonGroup,
} from '@grafana/ui';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

import { getDashboardSceneFor } from '../utils/utils';

export interface ViewPanelSidePaneState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
  fanoutMode?: string;
}

export class ViewPanelSidePane extends SceneObjectBase<ViewPanelSidePaneState> {
  public static Component = ViewPanelSidePaneRenderer;
  public getId() {
    return 'view-panel-pane';
  }

  public onSetMode(value: string | undefined) {
    this.setState({ fanoutMode: value });
  }

  public onToggleLegend(show: boolean) {
    const panel = this.state.panelRef.resolve();
    panel.onOptionsChange({
      ...panel.state.options,
      //@ts-expect-error
      legend: { ...panel.state.options?.legend, showLegend: show },
    });
  }

  public onToggleStacking(stacking: string) {
    const panel = this.state.panelRef.resolve();
    panel.onFieldConfigChange(
      {
        ...panel.state.fieldConfig,
        defaults: {
          ...panel.state.fieldConfig?.defaults,
          custom: {
            ...panel.state.fieldConfig?.defaults?.custom,
            stacking: {
              // @ts-expect-error
              ...panel.state.fieldConfig?.defaults?.custom?.stacking,
              mode: stacking,
            },
          },
        },
      },
      true
    );
  }
}

export function ViewPanelSidePaneRenderer({ model }: SceneComponentProps<ViewPanelSidePane>) {
  const dashboard = getDashboardSceneFor(model);
  const { viewPanel } = dashboard.useState();
  const { panelRef, fanoutMode } = model.useState();

  const [labels, setLabels] = useState<string[] | undefined>(undefined);
  const panel = panelRef.resolve();
  const { fieldConfig, options } = panel.useState();

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
  }, [viewPanel, dashboard, panel]);

  const modeValue = fanoutMode ?? '$__none__$';
  //@ts-expect-error
  const showLegend = options.legend?.showLegend ?? false;
  //@ts-expect-error
  const stacking = fieldConfig.defaults?.custom?.stacking?.mode ?? StackingMode.None;
  const stackingOptions = getGraphFieldOptions().stacking;

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
              <Trans i18nKey="dashboard.view-panel.back-to-dashboard">Back to dashboard</Trans>
            </Button>
          </Box>
          <OptionsPaneCategory
            title={t('dashboard.view-panel.quick-toggles', 'Quick toggles')}
            id="quick-toggles"
            isOpenDefault={true}
          >
            <Box direction="column" gap={2} display="flex" paddingLeft={1}>
              <Field label={t('dashboard.view-panel.show-legend', 'Show legend')} noMargin>
                <Switch value={showLegend} onChange={(e) => model.onToggleLegend(e.currentTarget.checked)} />
              </Field>
              <Field label={t('dashboard.view-panel.stacking', 'Stacking')} noMargin>
                <RadioButtonGroup
                  value={stacking}
                  options={stackingOptions}
                  onChange={(value) => model.onToggleStacking(value)}
                />
              </Field>
            </Box>
          </OptionsPaneCategory>
          <OptionsPaneCategory
            title={t('dashboard.view-panel.fanout-by-series-or-label', 'Fan-out by series or label')}
            id="fanout"
            isOpenDefault={true}
          >
            <Box direction="column" gap={1} display="flex" paddingLeft={1}>
              <RadioButtonDot
                name="fanout"
                id="$__none__$"
                label={t('dashboard.view-panel.disabled', 'Disabled')}
                checked={modeValue === '$__none__$'}
                onClick={() => model.onSetMode(undefined)}
              />
              <RadioButtonDot
                name="fanout"
                id={bySeriesMode}
                label={t('dashboard.view-panel.by-series', 'By series')}
                checked={modeValue === bySeriesMode}
                onClick={() => model.onSetMode(bySeriesMode)}
              />
            </Box>
            <Box padding={1}>
              <Text variant="bodySmall" weight="medium">
                {t('dashboard.view-panel.labels', 'Labels')}
              </Text>
            </Box>
            <Box direction="column" gap={1} display="flex" paddingLeft={1}>
              {labels && labels.length === 0 && (
                <Text italic variant="bodySmall">
                  {t('dashboard.view-panel.no-labels-found', 'Data has no labels')}
                </Text>
              )}
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
          {/* <OptionsPaneCategory title="Toggle queries" id="toggle-queries" isOpenDefault={false}>
            <Box direction="column" gap={1} display="flex" paddingLeft={1} alignItems="flex-start">
              <Checkbox id="toggle-queries-checkbox" checked={true} onChange={() => {}} label="Query A" />
              <Checkbox id="toggle-queries-checkbox" checked={true} onChange={() => {}} label="Query B" />
              <Checkbox id="toggle-queries-checkbox" checked={true} onChange={() => {}} label="Query C" />
            </Box>
          </OptionsPaneCategory> */}
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

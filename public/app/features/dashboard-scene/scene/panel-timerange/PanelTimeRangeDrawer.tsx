/* eslint @grafana/i18n/no-untranslated-strings: 0 */

import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Badge, Box, Button, Combobox, ComboboxOption, Drawer, Field, Label, Stack } from '@grafana/ui';

import { getQuickOptions } from '../../../../../../packages/grafana-ui/src/components/DateTimePickers/options';
import { getDashboardSceneFor, getQueryRunnerFor } from '../../utils/utils';

import { PanelTimeRange } from './PanelTimeRange';

export const DEFAULT_COMPARE_OPTIONS = [
  { label: 'Disabled', value: '' },
  { label: 'Day before', value: '24h' },
  { label: 'Week before', value: '1w' },
  { label: 'Month before', value: '1M' },
];

export type PanelTimeRangeZoomBehavior = 'panel_and_dashboard' | 'dashboard' | 'panel';

export interface PanelTimeRangeDrawerState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
  timeFrom?: string;
  timeShift?: string;
  zoomBehavior?: PanelTimeRangeZoomBehavior;
  hideTimeOverride?: boolean;
  compareWith?: string;
  timeFromLocked?: boolean;
}

export class PanelTimeRangeDrawer extends SceneObjectBase<PanelTimeRangeDrawerState> {
  public constructor(state: PanelTimeRangeDrawerState) {
    super({
      ...state,
    });

    const panel = this.state.panelRef.resolve();
    const timeRange = panel.state.$timeRange;

    if (timeRange instanceof PanelTimeRange) {
      this.setState({
        timeFrom: timeRange.state.timeFrom,
        timeShift: timeRange.state.timeShift,
        hideTimeOverride: timeRange.state.hideTimeOverride,
        compareWith: timeRange.state.compareWith,
      });
    }
  }

  public onClose = () => {
    getDashboardSceneFor(this).closeModal();
  };

  public onApply = () => {
    const panel = this.state.panelRef.resolve();
    let timeRange = panel.state.$timeRange;

    if (!(timeRange instanceof PanelTimeRange)) {
      timeRange = new PanelTimeRange();
    }

    timeRange.setState({
      timeFrom: this.state.timeFrom,
      timeShift: this.state.timeShift,
      hideTimeOverride: this.state.hideTimeOverride,
      compareWith: this.state.compareWith,
      zoomBehavior: this.state.zoomBehavior,
    });

    if (!panel.state.$timeRange) {
      panel.setState({ $timeRange: timeRange });
      const queryRunner = getQueryRunnerFor(panel);
      queryRunner?.runQueries();
    }

    this.onClose();
  };

  static Component = ({ model }: SceneComponentProps<PanelTimeRangeDrawer>) => {
    const { timeFrom, timeShift, compareWith, zoomBehavior = 'panel_and_dashboard' } = model.useState();

    const timeOptions = getQuickOptions().map((option, index) => ({ label: option.display, value: option.from }));
    timeOptions.unshift({ label: 'Disabled', value: '' });

    const timeShiftOptions = [
      { label: 'Disabled', value: '' },
      { label: '1 hour', value: '1h' },
      { label: '6 hours', value: '6h' },
      { label: '12 hours', value: '12h' },
      { label: '1 day', value: '24h' },
      { label: '7 days', value: '7d' },
      { label: '30 days', value: '30d' },
    ];

    const zoomBehaviorOptions: Array<ComboboxOption<PanelTimeRangeZoomBehavior>> = [
      {
        label: 'Panel and dashboard time',
        value: 'panel_and_dashboard',
      },
      {
        label: 'Panel time only',
        value: 'panel',
      },
      {
        label: 'Dashboard time only',
        value: 'dashboard',
      },
    ];

    return (
      <Drawer title="Panel time range settings" onClose={model.onClose} size="sm">
        <Stack direction="column" gap={2}>
          <Field
            label="Custom panel time range"
            noMargin
            description="Override the dashboard time range for this panel"
          >
            <Stack>
              <Combobox
                options={timeOptions}
                value={timeFrom ?? ''}
                onChange={(x) => {
                  model.setState({ timeFrom: x.value });
                }}
              />
            </Stack>
          </Field>
          <Field label="Zoom behavior" noMargin description="What time range should zoom actions modify">
            <Combobox
              options={zoomBehaviorOptions}
              value={zoomBehavior}
              onChange={(x) => {
                model.setState({ zoomBehavior: x.value });
              }}
            />
          </Field>
          <Field label="Time shift" noMargin description="Add a time shift relative to the dashboard time range">
            <Combobox
              options={timeShiftOptions}
              value={timeShift ?? ''}
              onChange={(x) => {
                model.setState({ timeFrom: x.value });
              }}
            />
          </Field>
          <Field
            noMargin
            label={
              <Stack alignItems={'center'} justifyContent={'space-between'}>
                <Label description="Query and overlay data from a different time period">Time window comparison</Label>{' '}
                <Badge color="blue" text="New!" />
              </Stack>
            }
          >
            <Combobox
              options={DEFAULT_COMPARE_OPTIONS}
              value={compareWith ?? ''}
              onChange={(x) => model.setState({ compareWith: x.value })}
            />
          </Field>

          <Box paddingTop={3}>
            <Stack>
              <Button variant="secondary" onClick={model.onClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={model.onApply}>
                Apply
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Drawer>
    );
  };
}

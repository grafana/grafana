import { FeatureState } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Box, Button, Combobox, Drawer, FeatureBadge, Field, Label, Stack, Switch } from '@grafana/ui';

import { getQuickOptions } from '../../../../../../packages/grafana-ui/src/components/DateTimePickers/options';
import { getDashboardSceneFor, getQueryRunnerFor } from '../../utils/utils';

import { PanelTimeRange } from './PanelTimeRange';

export const DEFAULT_COMPARE_OPTIONS = [
  { label: 'Disabled', value: '' },
  { label: 'Day before', value: '1d' },
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
    const { timeFrom, timeShift, compareWith, hideTimeOverride } = model.useState();

    const timeOptions = getQuickOptions()
      .filter((o) => {
        // Filter out time options that are not relative to now as we do not have persitance support for those yet
        return o.to === 'now';
      })
      .map((option, index) => ({ label: option.display, value: option.from }));

    timeOptions.unshift({ label: t('common.disabled', 'Disabled'), value: '' });

    const timeShiftOptions = [
      { label: t('common.disabled', 'Disabled'), value: '' },
      { label: t('time-period.1_hour', '1 hour'), value: '1h' },
      { label: t('time-period.6_hours', '6 hours'), value: '6h' },
      { label: t('time-period.12_hours', '12 hours'), value: '12h' },
      { label: t('time-period.1_day', '1 day'), value: '24h' },
      { label: t('time-period.7_days', '7 days'), value: '7d' },
      { label: t('time-period.30_days', '30 days'), value: '30d' },
    ];

    return (
      <Drawer
        title={t('dashboard.panel.time-range-settings.title', 'Panel time range settings')}
        onClose={model.onClose}
        size="sm"
      >
        <Stack direction="column" gap={2}>
          <Field
            label={t('dashboard.panel.time-range-settings.time-from', 'Custom panel time range')}
            noMargin
            description={t(
              'dashboard.panel.time-range-settings.time-from-description',
              'Overrides the dashboard time range. To specify a value not found in the list just type in a custom value, for example 5m or 2h'
            )}
          >
            <Stack>
              <Combobox
                options={timeOptions}
                value={timeFrom ?? ''}
                createCustomValue={true}
                onChange={(x) => {
                  model.setState({ timeFrom: x.value });
                }}
              />
            </Stack>
          </Field>
          <Field
            label={t('dashboard.panel.time-range-settings.time-shift', 'Time shift')}
            noMargin
            description={t(
              'dashboard.panel.time-range-settings.time-shift-description',
              'Adds a time shift relative to the dashboard or panel time range. To specify a value not found in the list just type in a custom value, for example 5m or 2h'
            )}
          >
            <Combobox
              options={timeShiftOptions}
              value={timeShift ?? ''}
              createCustomValue={true}
              onChange={(x) => {
                model.setState({ timeShift: x.value });
              }}
            />
          </Field>

          {(timeFrom || timeShift || compareWith) && (
            <Field
              noMargin
              label={t('dashboard.panel.time-range-settings.hide-time-info', 'Hidden time info')}
              description={t(
                'dashboard.panel.time-range-settings.hide-time-info-description',
                'Do not show the custom time range in the panel header'
              )}
            >
              <Switch
                value={hideTimeOverride}
                onChange={(x) => model.setState({ hideTimeOverride: x.currentTarget.checked })}
              />
            </Field>
          )}
          <Field
            noMargin
            label={
              <Stack alignItems={'center'} justifyContent={'space-between'}>
                <Label
                  description={t(
                    'dashboard.panel.time-range-settings.time-window-compare-description',
                    'Query and overlay data from a different time period'
                  )}
                >
                  <Trans i18nKey="dashboard.panel.time-range-settings.time-window-compare">
                    Time window comparison
                  </Trans>
                </Label>
                <FeatureBadge featureState={FeatureState.new} />
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
                <Trans i18nKey="common.cancel">Cancel</Trans>
              </Button>
              <Button variant="primary" onClick={model.onApply}>
                <Trans i18nKey="common.apply">Apply</Trans>
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Drawer>
    );
  };
}

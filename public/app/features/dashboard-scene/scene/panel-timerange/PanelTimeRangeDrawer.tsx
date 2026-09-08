import { FeatureState } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  type SceneComponentProps,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { type TimeCompareOptions, TimeCompareColorMode } from '@grafana/schema';
import {
  Box,
  Button,
  Combobox,
  type ComboboxOption,
  Drawer,
  FeatureBadge,
  Field,
  Label,
  Stack,
  Switch,
} from '@grafana/ui';

import { getQuickOptions } from '../../../../../../packages/grafana-ui/src/components/DateTimePickers/options';
import { getDashboardSceneFor, getQueryRunnerFor } from '../../utils/utils';

import { PanelTimeRange } from './PanelTimeRange';

export const getCompareOptions = () => [
  { label: t('common.disabled', 'Disabled'), value: '' },
  { label: t('dashboard.panel.time-range-settings.compare-day-before', 'Day before'), value: '1d' },
  { label: t('dashboard.panel.time-range-settings.compare-week-before', 'Week before'), value: '1w' },
  { label: t('dashboard.panel.time-range-settings.compare-month-before', 'Month before'), value: '1M' },
];

const getCompareColorModeOptions = (): Array<ComboboxOption<TimeCompareColorMode>> => [
  {
    label: t('dashboard.panel.time-range-settings.compare-color-mode-standard', 'Standard'),
    value: TimeCompareColorMode.Standard,
  },
  {
    label: t('dashboard.panel.time-range-settings.compare-color-mode-inverted', 'Inverted'),
    value: TimeCompareColorMode.Inverted,
  },
  {
    label: t('dashboard.panel.time-range-settings.compare-color-mode-same-as-value', 'Same as value'),
    value: TimeCompareColorMode.SameAsValue,
  },
];

// Only panels that render a comparison delta in their tooltip can honor the color mode.
const PLUGINS_WITH_COMPARISON_DELTA = new Set(['timeseries']);

/**
 * `VizPanel` is generic over its plugin's options, so they are untyped here. The time comparison
 * block is a shared common schema type, and every field on it is optional.
 */
function getCompareColorMode(panel: VizPanel): TimeCompareColorMode | undefined {
  const options: { timeCompare?: TimeCompareOptions } = panel.state.options;
  return options.timeCompare?.colorMode;
}

export type PanelTimeRangeZoomBehavior = 'panel_and_dashboard' | 'dashboard' | 'panel';

export interface PanelTimeRangeDrawerState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
  timeFrom?: string;
  timeShift?: string;
  zoomBehavior?: PanelTimeRangeZoomBehavior;
  hideTimeOverride?: boolean;
  compareWith?: string;
  compareColorMode?: TimeCompareColorMode;
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

    // The color mode only affects how the panel renders the comparison, so it lives in panel
    // options rather than on PanelTimeRange.
    this.setState({ compareColorMode: getCompareColorMode(panel) });
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

    // Only written when it changed, so applying the drawer on a panel that never set a color mode
    // does not add an inert time comparison block to its saved options.
    const { compareColorMode } = this.state;
    if (compareColorMode !== getCompareColorMode(panel)) {
      panel.onOptionsChange({ timeCompare: { colorMode: compareColorMode } });
    }

    if (!panel.state.$timeRange) {
      panel.setState({ $timeRange: timeRange });
      const queryRunner = getQueryRunnerFor(panel);
      queryRunner?.runQueries();
    }

    this.onClose();
  };

  static Component = ({ model }: SceneComponentProps<PanelTimeRangeDrawer>) => {
    const { timeFrom, timeShift, compareWith, compareColorMode, hideTimeOverride, panelRef } = model.useState();

    const supportsComparisonDelta = PLUGINS_WITH_COMPARISON_DELTA.has(panelRef.resolve().state.pluginId);

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
        title={t('dashboard.panel.time-range-settings.title', 'Panel time settings')}
        onClose={model.onClose}
        size="sm"
      >
        <Stack direction="column" gap={2}>
          <Field
            label={t('dashboard.panel.time-range-settings.time-from', 'Panel time range')}
            noMargin
            description={t(
              'dashboard.panel.time-range-settings.time-from-description',
              'Overrides the dashboard time range. Use one of the preset values or enter a custom value like 5m or 2h.'
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
              'Adds a time shift relative to the dashboard or panel time range. Use one of the preset values or enter a custom value like 5m or 2h.'
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

          {config.featureToggles.timeComparison && (
            <Field
              noMargin
              label={
                <Stack alignItems={'center'} justifyContent={'space-between'}>
                  <Label
                    description={t(
                      'dashboard.panel.time-range-settings.time-window-compare-description',
                      'Compare data between two time ranges'
                    )}
                  >
                    <Trans i18nKey="dashboard.panel.time-range-settings.time-window-compare">Time comparison</Trans>
                  </Label>
                  <FeatureBadge featureState={FeatureState.new} />
                </Stack>
              }
            >
              <Combobox
                options={getCompareOptions()}
                createCustomValue={true}
                value={compareWith ?? ''}
                onChange={(x) => model.setState({ compareWith: x.value })}
              />
            </Field>
          )}

          {config.featureToggles.timeComparison && compareWith && supportsComparisonDelta && (
            <Field
              noMargin
              label={t('dashboard.panel.time-range-settings.compare-color-mode', 'Comparison tooltip delta color')}
              description={t(
                'dashboard.panel.time-range-settings.compare-color-mode-description',
                'Colors delta between original and comparison value in the tooltip. Increase in value is green for standard, red for inverted, or the series color for same as value.'
              )}
            >
              <Combobox
                options={getCompareColorModeOptions()}
                value={compareColorMode ?? TimeCompareColorMode.Standard}
                onChange={(x) => model.setState({ compareColorMode: x.value })}
              />
            </Field>
          )}

          <Field
            noMargin
            label={t('dashboard.panel.time-range-settings.hide-time-info', 'Hide panel time range')}
            description={t(
              'dashboard.panel.time-range-settings.hide-time-info-description',
              'Do not show the panel time range in the panel header'
            )}
          >
            <Switch
              value={Boolean(hideTimeOverride)}
              onChange={(x) => model.setState({ hideTimeOverride: x.currentTarget.checked })}
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

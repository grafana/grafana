import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  AxisPlacement,
  BarAlignment,
  GraphDrawStyle,
  GraphGradientMode,
  GraphThresholdsStyleMode,
  LineInterpolation,
  VisibilityMode,
  StackingMode,
} from '@grafana/schema';

export const getGraphFieldOptions: () => {
  drawStyle: Array<SelectableValue<GraphDrawStyle>>;
  lineInterpolation: Array<SelectableValue<LineInterpolation>>;
  barAlignment: Array<SelectableValue<BarAlignment>>;
  showPoints: Array<SelectableValue<VisibilityMode>>;
  axisPlacement: Array<SelectableValue<AxisPlacement>>;
  fillGradient: Array<SelectableValue<GraphGradientMode>>;
  stacking: Array<SelectableValue<StackingMode>>;
  thresholdsDisplayModes: Array<SelectableValue<GraphThresholdsStyleMode>>;
} = () => ({
  drawStyle: [
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.draw-style.label-lines', 'Lines'),
      value: GraphDrawStyle.Line,
    },
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.draw-style.label-bars', 'Bars'),
      value: GraphDrawStyle.Bars,
    },
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.draw-style.label-points', 'Points'),
      value: GraphDrawStyle.Points,
    },
  ],

  lineInterpolation: [
    {
      description: t(
        'grafana-ui.u-plot.config.get-graph-field-options.line-interpolation.description-linear',
        'Linear'
      ),
      value: LineInterpolation.Linear,
      icon: 'gf-interpolation-linear',
    },
    {
      description: t(
        'grafana-ui.u-plot.config.get-graph-field-options.line-interpolation.description-smooth',
        'Smooth'
      ),
      value: LineInterpolation.Smooth,
      icon: 'gf-interpolation-smooth',
    },
    {
      description: t(
        'grafana-ui.u-plot.config.get-graph-field-options.line-interpolation.description-step-before',
        'Step before'
      ),
      value: LineInterpolation.StepBefore,
      icon: 'gf-interpolation-step-before',
    },
    {
      description: t(
        'grafana-ui.u-plot.config.get-graph-field-options.line-interpolation.description-step-after',
        'Step after'
      ),
      value: LineInterpolation.StepAfter,
      icon: 'gf-interpolation-step-after',
    },
  ],

  barAlignment: [
    {
      description: t('grafana-ui.u-plot.config.get-graph-field-options.bar-alignment.description-before', 'Before'),
      value: BarAlignment.Before,
      icon: 'gf-bar-alignment-before',
    },
    {
      description: t('grafana-ui.u-plot.config.get-graph-field-options.bar-alignment.description-center', 'Center'),
      value: BarAlignment.Center,
      icon: 'gf-bar-alignment-center',
    },
    {
      description: t('grafana-ui.u-plot.config.get-graph-field-options.bar-alignment.description-after', 'After'),
      value: BarAlignment.After,
      icon: 'gf-bar-alignment-after',
    },
  ],

  showPoints: [
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.show-points.label-auto', 'Auto'),
      value: VisibilityMode.Auto,
      description: t(
        'grafana-ui.u-plot.config.get-graph-field-options.show-points.description-auto',
        'Show points when the density is low'
      ),
    },
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.show-points.label-always', 'Always'),
      value: VisibilityMode.Always,
    },
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.show-points.label-never', 'Never'),
      value: VisibilityMode.Never,
    },
  ],

  axisPlacement: [
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.axis-placement.label-auto', 'Auto'),
      value: AxisPlacement.Auto,
      description: t(
        'grafana-ui.u-plot.config.get-graph-field-options.axis-placement.description-auto',
        'First field on the left, everything else on the right'
      ),
    },
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.axis-placement.label-left', 'Left'),
      value: AxisPlacement.Left,
    },
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.axis-placement.label-right', 'Right'),
      value: AxisPlacement.Right,
    },
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.axis-placement.label-hidden', 'Hidden'),
      value: AxisPlacement.Hidden,
    },
  ],

  fillGradient: [
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.fill-gradient.label-none', 'None'),
      value: GraphGradientMode.None,
    },
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.fill-gradient.label-opacity', 'Opacity'),
      value: GraphGradientMode.Opacity,
      description: t(
        'grafana-ui.u-plot.config.get-graph-field-options.fill-gradient.description-opacity',
        'Enable fill opacity gradient'
      ),
    },
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.fill-gradient.label-hue', 'Hue'),
      value: GraphGradientMode.Hue,
      description: t(
        'grafana-ui.u-plot.config.get-graph-field-options.fill-gradient.description-hue',
        'Small color hue gradient'
      ),
    },
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.fill-gradient.label-scheme', 'Scheme'),
      value: GraphGradientMode.Scheme,
      description: t(
        'grafana-ui.u-plot.config.get-graph-field-options.fill-gradient.description-scheme',
        'Use color scheme to define gradient'
      ),
    },
  ],

  stacking: [
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.stacking.label-off', 'Off'),
      value: StackingMode.None,
    },
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.stacking.label-normal', 'Normal'),
      value: StackingMode.Normal,
    },
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.stacking.label-100', '100%'),
      value: StackingMode.Percent,
    },
  ],

  thresholdsDisplayModes: [
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.thresholds-display-mode.label-off', 'Off'),
      value: GraphThresholdsStyleMode.Off,
    },
    {
      label: t('grafana-ui.u-plot.config.get-graph-field-options.thresholds-display-mode.label-lines', 'As lines'),
      value: GraphThresholdsStyleMode.Line,
    },
    {
      label: t(
        'grafana-ui.u-plot.config.get-graph-field-options.thresholds-display-mode.label-dashed-lines',
        'As lines (dashed)'
      ),
      value: GraphThresholdsStyleMode.Dashed,
    },
    {
      label: t(
        'grafana-ui.u-plot.config.get-graph-field-options.thresholds-display-mode.label-filled-regions',
        'As filled regions'
      ),
      value: GraphThresholdsStyleMode.Area,
    },
    {
      label: t(
        'grafana-ui.u-plot.config.get-graph-field-options.thresholds-display-mode.label-filled-regions-and-lines',
        'As filled regions and lines'
      ),
      value: GraphThresholdsStyleMode.LineAndArea,
    },
    {
      label: t(
        'grafana-ui.u-plot.config.get-graph-field-options.thresholds-display-mode.label-filled-regions-and-dashed-lines',
        'As filled regions and lines (dashed)'
      ),
      value: GraphThresholdsStyleMode.DashedAndArea,
    },
  ],
});

/**
 * @deprecated Use `getGraphFieldOptions` instead so translations load correctly.
 */
export const graphFieldOptions = getGraphFieldOptions();

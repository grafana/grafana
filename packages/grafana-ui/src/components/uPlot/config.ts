import { SelectableValue } from '@grafana/data';
import {
  AxisPlacement,
  BarAlignment,
  GraphDrawStyle,
  GraphGradientMode,
  GraphTresholdsStyleMode,
  LineInterpolation,
  VisibilityMode,
  StackingMode,
} from '@grafana/schema';

/**
 * @alpha
 */
export const graphFieldOptions = {
  drawStyle: [
    { label: 'Lines', value: GraphDrawStyle.Line },
    { label: 'Bars', value: GraphDrawStyle.Bars },
    { label: 'Points', value: GraphDrawStyle.Points },
  ] as Array<SelectableValue<GraphDrawStyle>>,

  lineInterpolation: [
    { description: 'Linear', value: LineInterpolation.Linear, icon: 'gf-interpolation-linear' },
    { description: 'Smooth', value: LineInterpolation.Smooth, icon: 'gf-interpolation-smooth' },
    { description: 'Step before', value: LineInterpolation.StepBefore, icon: 'gf-interpolation-step-before' },
    { description: 'Step after', value: LineInterpolation.StepAfter, icon: 'gf-interpolation-step-after' },
  ] as Array<SelectableValue<LineInterpolation>>,

  barAlignment: [
    { description: 'Before', value: BarAlignment.Before, icon: 'gf-bar-alignment-before' },
    { description: 'Center', value: BarAlignment.Center, icon: 'gf-bar-alignment-center' },
    { description: 'After', value: BarAlignment.After, icon: 'gf-bar-alignment-after' },
  ] as Array<SelectableValue<BarAlignment>>,

  showPoints: [
    { label: 'Auto', value: VisibilityMode.Auto, description: 'Show points when the density is low' },
    { label: 'Always', value: VisibilityMode.Always },
    { label: 'Never', value: VisibilityMode.Never },
  ] as Array<SelectableValue<VisibilityMode>>,

  axisPlacement: [
    { label: 'Auto', value: AxisPlacement.Auto, description: 'First field on the left, everything else on the right' },
    { label: 'Left', value: AxisPlacement.Left },
    { label: 'Right', value: AxisPlacement.Right },
    { label: 'Hidden', value: AxisPlacement.Hidden },
  ] as Array<SelectableValue<AxisPlacement>>,

  fillGradient: [
    { label: 'None', value: GraphGradientMode.None },
    { label: 'Opacity', value: GraphGradientMode.Opacity, description: 'Enable fill opacity gradient' },
    { label: 'Hue', value: GraphGradientMode.Hue, description: 'Small color hue gradient' },
    {
      label: 'Scheme',
      value: GraphGradientMode.Scheme,
      description: 'Use color scheme to define gradient',
    },
  ] as Array<SelectableValue<GraphGradientMode>>,

  stacking: [
    { label: 'Off', value: StackingMode.None },
    { label: 'Normal', value: StackingMode.Normal },
    { label: '100%', value: StackingMode.Percent },
  ] as Array<SelectableValue<StackingMode>>,

  thresholdsDisplayModes: [
    { label: 'Off', value: GraphTresholdsStyleMode.Off },
    { label: 'As lines', value: GraphTresholdsStyleMode.Line },
    { label: 'As lines (dashed)', value: GraphTresholdsStyleMode.Dashed },
    { label: 'As filled regions', value: GraphTresholdsStyleMode.Area },
    { label: 'As filled regions and lines', value: GraphTresholdsStyleMode.LineAndArea },
    { label: 'As filled regions and lines (dashed)', value: GraphTresholdsStyleMode.DashedAndArea },
  ] as Array<SelectableValue<GraphTresholdsStyleMode>>,
};

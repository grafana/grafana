import { PanelProps } from '@grafana/data';
import { HistogramPanel as HistogramPanelComponent, HistogramOptions, HistogramFieldConfig } from '@grafana/histogram';

import { Options, FieldConfig } from './panelcfg.gen';

type Props = PanelProps<Options>;

// Adapter function: Transform Grafana's CUE-generated config to clean histogram config
function adaptGrafanaToHistogram(
  grafanaOptions: Options,
  grafanaFieldConfig: FieldConfig
): { options: HistogramOptions; fieldConfig: HistogramFieldConfig } {
  return {
    options: {
      bucketCount: grafanaOptions.bucketCount,
      bucketSize: grafanaOptions.bucketSize,
      bucketOffset: grafanaOptions.bucketOffset,
      combine: grafanaOptions.combine ?? false,
      legend: grafanaOptions.legend,
      tooltip: grafanaOptions.tooltip,
    },
    fieldConfig: {
      lineWidth: grafanaFieldConfig.lineWidth,
      fillOpacity: grafanaFieldConfig.fillOpacity,
      gradientMode: grafanaFieldConfig.gradientMode,
      stacking: grafanaFieldConfig.stacking,
      // Include extended properties from AxisConfig and HideableFieldConfig
      hideFrom: grafanaFieldConfig.hideFrom,
      axisSoftMin: grafanaFieldConfig.axisSoftMin,
      axisSoftMax: grafanaFieldConfig.axisSoftMax,
    },
  };
}

export const HistogramPanel = (props: Props) => {
  const { options, fieldConfig } = adaptGrafanaToHistogram(props.options, props.fieldConfig?.defaults?.custom || {});

  return (
    <HistogramPanelComponent
      data={props.data}
      options={options}
      fieldConfig={fieldConfig}
      width={props.width}
      height={props.height}
    />
  );
};

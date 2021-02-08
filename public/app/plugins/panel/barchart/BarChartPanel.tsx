import React, { useCallback, useMemo } from 'react';
import { DataFrame, Field, FieldType, PanelProps } from '@grafana/data';
import { BarChart, BarChartOptions, GraphNGLegendEvent } from '@grafana/ui';
import { changeSeriesColorConfigFactory } from '../timeseries/overrides/colorSeriesConfigFactory';
import { hideSeriesConfigFactory } from '../timeseries/overrides/hideSeriesConfigFactory';
import { config } from 'app/core/config';

interface Props extends PanelProps<BarChartOptions> {}

interface BarData {
  error?: string;
  frame?: DataFrame; // first string vs all numbers
}

/**
 * @alpha
 */
export const BarChartPanel: React.FunctionComponent<Props> = ({
  data,
  options,
  width,
  height,
  fieldConfig,
  onFieldConfigChange,
}) => {
  if (!data || !data.series?.length) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const onLegendClick = useCallback(
    (event: GraphNGLegendEvent) => {
      onFieldConfigChange(hideSeriesConfigFactory(event, fieldConfig, data.series));
    },
    [fieldConfig, onFieldConfigChange, data.series]
  );

  const onSeriesColorChange = useCallback(
    (label: string, color: string) => {
      onFieldConfigChange(changeSeriesColorConfigFactory(label, color, fieldConfig));
    },
    [fieldConfig, onFieldConfigChange]
  );

  const barData = useMemo<BarData>(() => {
    const firstFrame = data.series[0];
    const firstString = firstFrame.fields.find((f) => f.type === FieldType.string);
    if (!firstString) {
      return {
        error: 'Bar charts requires a string field',
      };
    }
    const fields: Field[] = [firstString];
    for (const f of firstFrame.fields) {
      if (f.type === FieldType.number) {
        fields.push(f);
      }
    }
    if (fields.length < 2) {
      return {
        error: 'No numeric fields found',
      };
    }

    return {
      frame: {
        ...firstFrame,
        fields, // filtered to to the values we have
      },
    };
  }, [width, height, options, data]);

  if (barData.error) {
    return (
      <div className="panel-empty">
        <p>{barData.error}</p>
      </div>
    );
  }

  if (!barData.frame) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  return (
    <BarChart
      data={barData.frame}
      width={width}
      height={height}
      theme={config.theme}
      onLegendClick={onLegendClick}
      onSeriesColorChange={onSeriesColorChange}
      {...options}
    />
  );
};

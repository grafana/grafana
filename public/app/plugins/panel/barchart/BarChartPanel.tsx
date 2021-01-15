import React, { useMemo } from 'react';
import { DataFrame, Field, FieldType, PanelProps } from '@grafana/data';
import { Alert, BarChart, BarChartOptions } from '@grafana/ui';
import { config } from 'app/core/config';

interface Props extends PanelProps<BarChartOptions> {}

interface BarData {
  error?: string;
  frame?: DataFrame; // first string vs all numbers
}

export const BarChartPanel: React.FunctionComponent<Props> = ({ data, options, width, height }) => {
  if (!data || !data.series?.length) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const barData = useMemo<BarData>(() => {
    const firstFrame = data.series[0];
    const firstString = firstFrame.fields.find(f => f.type === FieldType.string);
    if (!firstString) {
      return {
        error: 'Panel requires a string field',
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
      <div>
        <Alert title={barData.error} severity="warning" />
      </div>
    );
  }

  if (!barData.frame) {
    return (
      <div>
        <Alert title="missing data" severity="error" />
      </div>
    );
  }

  return <BarChart data={barData.frame} width={width} height={height} theme={config.theme} {...options} />;
};

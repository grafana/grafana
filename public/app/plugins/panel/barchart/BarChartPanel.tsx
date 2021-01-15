import React, { useMemo } from 'react';
import { DataFrame, Field, FieldType, PanelProps, VizOrientation } from '@grafana/data';
import { BarChartOptions, defaults } from './types';
import { Alert } from '@grafana/ui';

interface Props extends PanelProps<BarChartOptions> {}

interface BarData {
  options: BarChartOptions;
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
    const opts = { ...defaults, ...options };
    if (opts.orientation === VizOrientation.Auto) {
      opts.orientation = width - height > 0 ? VizOrientation.Horizontal : VizOrientation.Vertical;
    }
    const firstFrame = data.series[0];
    const firstString = firstFrame.fields.find(f => f.type === FieldType.string);
    if (!firstString) {
      return {
        options: opts,
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
        options: opts,
        error: 'No numeric fields found',
      };
    }

    return {
      options: opts,
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

  return (
    <div>
      <pre>{JSON.stringify(barData.options, null, '  ')}</pre>
      {barData.frame.fields.map((f, idx) => (
        <div key={f.name + '/' + idx}>{f.name}</div>
      ))}
    </div>
  );
};

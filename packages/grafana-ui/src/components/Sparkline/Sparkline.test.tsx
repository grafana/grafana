import { render, screen } from '@testing-library/react';

import { createTheme, Field, FieldSparkline, FieldType } from '@grafana/data';

import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  describe('renders without error', () => {
    const numField = (name: string, numVals: number): Field => ({
      name,
      values: Array.from({ length: numVals }, (_, i) => i + 1),
      type: FieldType.number,
      config: {},
      state:
        numVals > 0
          ? {
              range: { min: 1, max: numVals, delta: numVals - 1 },
            }
          : {},
    });

    const startTime = 1679839200000;
    const timeField = (name: string, numVals: number): Field => ({
      name,
      values: Array.from({ length: numVals }, (_, i) => startTime + (i + 1) * 1000),
      type: FieldType.time,
      config: {},
      state:
        numVals > 0
          ? {
              range: { min: 1, max: numVals, delta: numVals - 1 },
            }
          : {},
    });

    it.each<{ description: string; input: FieldSparkline; warning?: boolean }>([
      {
        description: 'x=time, y=number, 5 values',
        input: {
          x: timeField('x', 5),
          y: numField('y', 5),
        },
      },
      {
        description: 'x=time, y=number, 1 value',
        input: {
          x: timeField('x', 1),
          y: numField('y', 1),
        },
        warning: true,
      },
      {
        description: 'x=time, y=number, 0 values',
        input: {
          x: timeField('x', 0),
          y: numField('y', 0),
        },
        warning: true,
      },
      {
        description: 'x=time (unordered), y=number, 5 values',
        input: {
          x: {
            ...timeField('x', 5),
            values: timeField('x', 5).values.reverse(),
          },
          y: timeField('y', 5),
        },
        warning: true,
      },
      {
        description: 'x=number, y=number, 5 values',
        input: {
          x: numField('x', 5),
          y: numField('y', 5),
        },
      },
      {
        description: 'x=number, y=number, 1 value',
        input: {
          x: numField('x', 1),
          y: numField('y', 1),
        },
        warning: true,
      },
      {
        description: 'x=number, y=number, 0 values',
        input: {
          x: numField('x', 0),
          y: numField('y', 0),
        },
        warning: true,
      },
      {
        description: 'y=number, 5 values',
        input: {
          y: numField('y', 5),
        },
      },
      {
        description: 'y=number, 1 value',
        input: {
          y: numField('y', 1),
        },
        warning: true,
      },
      {
        description: 'y=number, 0 values',
        input: {
          y: numField('y', 0),
        },
        warning: true,
      },
    ])('does not throw for "$description"', ({ input, warning }) => {
      expect(() =>
        render(<Sparkline width={800} height={600} theme={createTheme()} sparkline={input} />)
      ).not.toThrow();

      if (warning) {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      } else {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByTestId('uplot-main-div')).toBeInTheDocument();
      }
    });
  });
});

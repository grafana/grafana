import { act, render, type RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type uPlot from 'uplot';

import { FieldType, type FieldConfigSource, type ThresholdsConfig, getValueFormat } from '@grafana/data';
import { type UPlotConfigBuilder } from '@grafana/ui';
import { buildScaleKey } from '@grafana/ui/internal';

import { ThresholdControlsPlugin } from './ThresholdControlsPlugin';

// Stub drag UI so we can assert threshold reordering without simulating react-draggable in jsdom.
jest.mock('./ThresholdDragHandle', () => {
  const React = require('react');
  return {
    ThresholdDragHandle: ({
      onChange,
      formatValue,
      step,
    }: {
      onChange?: (value: number) => void;
      formatValue: (v: number) => string;
      step: { value: number };
    }) =>
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': `threshold-handle-${step.value}`,
          onClick: () => onChange?.(200),
        },
        formatValue(step.value)
      ),
  };
});

describe('ThresholdControlsPlugin', () => {
  let hooks: Record<string, (...args: unknown[]) => void>;
  let config: UPlotConfigBuilder;

  const defaultFieldConfig: FieldConfigSource = {
    defaults: {
      thresholds: {
        mode: 'absolute',
        steps: [
          { value: 0, color: 'green' },
          { value: 50, color: 'red' },
        ],
      },
      decimals: 2,
    },
    overrides: [],
  };

  beforeEach(() => {
    hooks = {};
    config = {
      setPadding: jest.fn(),
      addHook: jest.fn((type: string, hook: (...args: unknown[]) => void) => {
        hooks[type] = hook;
      }),
    } as unknown as UPlotConfigBuilder;
  });

  function renderPlugin(options?: {
    fieldConfig?: FieldConfigSource;
    onThresholdsChange?: (thresholds: ThresholdsConfig) => void;
  }): RenderResult {
    return render(
      <ThresholdControlsPlugin
        config={config}
        fieldConfig={options?.fieldConfig ?? defaultFieldConfig}
        onThresholdsChange={options?.onThresholdsChange}
      />
    );
  }

  describe('before the plot init hook runs', () => {
    it('returns null', () => {
      const { container } = renderPlugin();

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('after init and draw', () => {
    it('renders the threshold gutter and drag handles after init and draw hooks run', () => {
      const scale = buildScaleKey(defaultFieldConfig.defaults, FieldType.number);
      const decimals = defaultFieldConfig.defaults.decimals;
      const label0 = getValueFormat(scale)(0, decimals).text;
      const label50 = getValueFormat(scale)(50, decimals).text;

      const fakePlot = {
        bbox: { left: 100, top: 10, width: 200, height: 400 },
        valToPos: (value: number) => {
          if (value === 0) {
            return 50;
          }
          if (value === 50) {
            return 150;
          }
          return NaN;
        },
        posToVal: (y: number) => y,
      } as unknown as uPlot;

      const { container } = renderPlugin();

      act(() => {
        hooks.init(fakePlot);
        hooks.draw();
      });

      const gutter = container.firstChild as HTMLElement;
      expect(gutter).toHaveStyle({
        position: 'absolute',
        width: '60px',
        height: '400px',
        left: '300px',
        top: '10px',
      });

      expect(screen.getByText(label0)).toBeInTheDocument();
      expect(screen.getByText(label50)).toBeInTheDocument();
    });

    it('calls onThresholdsChange with sorted steps when a handle value changes', async () => {
      const onThresholdsChange = jest.fn();
      const user = userEvent.setup();

      const fakePlot = {
        bbox: { left: 100, top: 10, width: 200, height: 400 },
        valToPos: (value: number) => {
          if (value === 0) {
            return 50;
          }
          if (value === 50) {
            return 150;
          }
          return NaN;
        },
        posToVal: (y: number) => y,
      } as unknown as uPlot;

      renderPlugin({ onThresholdsChange });

      act(() => {
        hooks.init(fakePlot);
        hooks.draw();
      });

      await user.click(screen.getByTestId('threshold-handle-0'));

      expect(onThresholdsChange).toHaveBeenCalledTimes(1);
      expect(onThresholdsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'absolute',
          steps: [
            { value: 50, color: 'red' },
            { value: 200, color: 'green' },
          ],
        })
      );
    });
  });

  describe('regression', () => {
    // https://github.com/grafana/grafana/pull/41942 — wrong scale key caused valToPos to read undefined scales ("ori").
    it('passes buildScaleKey(fieldConfig.defaults, FieldType.number) to valToPos for each threshold step', () => {
      const expectedScaleKey = buildScaleKey(defaultFieldConfig.defaults, FieldType.number);

      const valToPos = jest.fn((value: number, scaleKey: string) => {
        expect(scaleKey).toBe(expectedScaleKey);
        if (value === 0) {
          return 50;
        }
        if (value === 50) {
          return 150;
        }
        return NaN;
      });

      const fakePlot = {
        bbox: { left: 100, top: 10, width: 200, height: 400 },
        valToPos,
        posToVal: (y: number) => y,
      } as unknown as uPlot;

      renderPlugin();

      act(() => {
        hooks.init(fakePlot);
        hooks.draw();
      });

      expect(valToPos).toHaveBeenCalledWith(0, expectedScaleKey);
      expect(valToPos).toHaveBeenCalledWith(50, expectedScaleKey);
      expect(valToPos).toHaveBeenCalledTimes(2);
    });
  });

  describe('threshold step mapping', () => {
    it('skips threshold steps when valToPos returns a non-finite y position', () => {
      const scale = buildScaleKey(defaultFieldConfig.defaults, FieldType.number);
      const decimals = defaultFieldConfig.defaults.decimals;
      const label50 = getValueFormat(scale)(50, decimals).text;

      const fakePlot = {
        bbox: { left: 100, top: 10, width: 200, height: 400 },
        valToPos: (value: number) => {
          if (value === 0) {
            return NaN;
          }
          if (value === 50) {
            return 150;
          }
          return NaN;
        },
        posToVal: (y: number) => y,
      } as unknown as uPlot;

      renderPlugin();

      act(() => {
        hooks.init(fakePlot);
        hooks.draw();
      });

      expect(screen.queryByTestId('threshold-handle-0')).not.toBeInTheDocument();
      expect(screen.getByTestId('threshold-handle-50')).toBeInTheDocument();
      expect(screen.getByText(label50)).toBeInTheDocument();
    });
  });
});

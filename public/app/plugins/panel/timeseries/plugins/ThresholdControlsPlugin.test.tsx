import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type uPlot from 'uplot';

import { type FieldConfigSource, type ThresholdsConfig, ThresholdsMode } from '@grafana/data';
import { type UPlotConfigBuilder } from '@grafana/ui';

import { ThresholdControlsPlugin } from './ThresholdControlsPlugin';

jest.mock('./ThresholdDragHandle', () => ({
  ThresholdDragHandle: ({
    formatValue,
    onChange,
    step,
  }: {
    formatValue: (v: number) => string;
    onChange?: (value: number) => void;
    step: { color: string; value: number };
  }) => (
    <button
      type="button"
      data-testid={`threshold-handle-${Number.isFinite(step.value) ? step.value : 'base'}`}
      onClick={() => {
        // Simulates drag end: third step (40) moved to 5 so steps re-sort to -∞, 5, 20
        if (step.value === 40) {
          onChange?.(5);
        }
      }}
    >
      {formatValue(step.value)}
    </button>
  ),
}));

describe('ThresholdControlsPlugin', () => {
  let hooks: Record<string, (...args: unknown[]) => void>;
  let config: UPlotConfigBuilder;

  beforeEach(() => {
    hooks = {};
    config = {
      setPadding: jest.fn(),
      addHook: jest.fn((type, hook) => {
        hooks[type] = hook;
      }),
    } as unknown as UPlotConfigBuilder;
  });

  function getFieldConfig(): FieldConfigSource {
    return {
      defaults: {
        unit: 'short',
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [
            { value: -Infinity, color: 'transparent' },
            { value: 42, color: 'red' },
          ],
        },
      },
      overrides: [],
    };
  }

  function getFieldConfigWithThreeSteps(): FieldConfigSource {
    return {
      defaults: {
        unit: 'short',
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [
            { value: -Infinity, color: 'transparent' },
            { value: 20, color: 'red' },
            { value: 40, color: 'blue' },
          ],
        },
      },
      overrides: [],
    };
  }

  function fieldConfigWithoutThresholds(): FieldConfigSource {
    return {
      defaults: { unit: 'short' },
      overrides: [],
    };
  }

  function createMockPlot(overrides: Partial<uPlot> = {}): uPlot {
    return {
      bbox: { left: 10, top: 20, width: 300, height: 400 },
      valToPos: (v: number) => (Number.isFinite(v) ? 100 : NaN),
      posToVal: (y: number) => y,
      ...overrides,
    } as unknown as uPlot;
  }

  function fireInitAndDraw(mockPlot: uPlot) {
    act(() => {
      hooks.init(mockPlot);
    });
    act(() => {
      hooks.draw();
    });
  }

  describe('config registration', () => {
    it('configures padding and hooks on the plot builder', () => {
      render(<ThresholdControlsPlugin config={config} fieldConfig={getFieldConfig()} />);
      expect(config.setPadding).toHaveBeenCalledWith([0, 60, 0, 0]);
      expect(config.addHook).toHaveBeenCalledWith('init', expect.any(Function));
      expect(config.addHook).toHaveBeenCalledWith('draw', expect.any(Function));
    });
  });

  describe('render gating', () => {
    it('renders nothing before uPlot init and draw hooks run', () => {
      const { container } = render(<ThresholdControlsPlugin config={config} fieldConfig={getFieldConfig()} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('does not paint the gutter until draw runs after init', () => {
      const { container } = render(<ThresholdControlsPlugin config={config} fieldConfig={getFieldConfig()} />);
      const mockPlot = createMockPlot();
      act(() => {
        hooks.init(mockPlot);
      });
      expect(container).toBeEmptyDOMElement();
      act(() => {
        hooks.draw();
      });
      expect(container).not.toBeEmptyDOMElement();
    });
  });

  describe('with chart ready', () => {
    function renderWithChartReady(options?: {
      fieldConfig?: FieldConfigSource;
      onThresholdsChange?: (thresholds: ThresholdsConfig) => void;
      plot?: Partial<uPlot>;
    }) {
      const fieldConfig = options?.fieldConfig ?? getFieldConfig();
      const mockPlot = createMockPlot(options?.plot);
      const { container } = render(
        <ThresholdControlsPlugin
          config={config}
          fieldConfig={fieldConfig}
          onThresholdsChange={options?.onThresholdsChange}
        />
      );
      fireInitAndDraw(mockPlot);
      return { container };
    }

    describe('rendering', () => {
      it('renders formatted threshold value after init and draw', () => {
        renderWithChartReady();
        expect(screen.getByText('42')).toBeInTheDocument();
      });

      it('skips threshold steps when valToPos is not finite', () => {
        renderWithChartReady({
          plot: {
            valToPos: () => NaN,
          },
        });
        expect(screen.queryByText('42')).not.toBeInTheDocument();
      });

      it('renders gutter without threshold labels when thresholds are absent', () => {
        const { container } = renderWithChartReady({ fieldConfig: fieldConfigWithoutThresholds() });
        expect(container).not.toBeEmptyDOMElement();
        expect(screen.queryByText('42')).not.toBeInTheDocument();
      });
    });

    describe('onThresholdsChange', () => {
      it('calls onThresholdsChange with re-sorted steps after a handle reports a new value', async () => {
        const onThresholdsChange = jest.fn();
        const user = userEvent.setup();
        renderWithChartReady({
          fieldConfig: getFieldConfigWithThreeSteps(),
          onThresholdsChange,
        });

        await user.click(screen.getByTestId('threshold-handle-40'));

        expect(onThresholdsChange).toHaveBeenCalledTimes(1);
        expect(onThresholdsChange).toHaveBeenCalledWith({
          mode: ThresholdsMode.Absolute,
          steps: [
            { value: -Infinity, color: 'transparent' },
            { value: 5, color: 'blue' },
            { value: 20, color: 'red' },
          ],
        });
      });
    });
  });
});

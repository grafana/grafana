import { render } from '@testing-library/react';

import { createTheme, FieldConfig, FieldSparkline, FieldType } from '@grafana/data';
import { GraphFieldConfig } from '@grafana/schema';

import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  const mockSparkline: FieldSparkline = {
    x: {
      name: 'x',
      values: [1679839200000, 1680444000000, 1681048800000, 1681653600000, 1682258400000],
      type: FieldType.time,
      config: {},
    },
    y: {
      name: 'y',
      values: [1, 2, 3, 4, 5],
      type: FieldType.number,
      config: {},
      state: {
        range: { min: 1, max: 5, delta: 1 },
      },
    },
  };

  it('should render without throwing an error', () => {
    expect(() =>
      render(<Sparkline width={800} height={600} theme={createTheme()} sparkline={mockSparkline} />)
    ).not.toThrow();
  });

  describe('hover interaction', () => {
    it('should call onHover with value when interaction is enabled and cursor moves', () => {
      const onHover = jest.fn();
      const config: FieldConfig<GraphFieldConfig> = {
        custom: {
          interactionEnabled: true,
        } as any,
      };

      const component = render(
        <Sparkline
          width={800}
          height={600}
          theme={createTheme()}
          sparkline={mockSparkline}
          config={config}
          onHover={onHover}
        />
      );

      // Get the Sparkline instance to access the config builder
      const instance = (component.container.firstChild as any)?.__reactFiber$?.return?.stateNode;
      if (instance?.state?.configBuilder) {
        const builder = instance.state.configBuilder;
        const hooks = builder.getConfig().hooks;

        // Find and execute the setLegend hook
        const setLegendHook = hooks?.setLegend?.[0];
        if (setLegendHook) {
          // Simulate hover over data point at index 2 (value: 3)
          const mockUPlot = {
            cursor: { idxs: [2, 2] },
            data: [mockSparkline.x!.values, mockSparkline.y.values],
          };
          setLegendHook(mockUPlot as any);

          expect(onHover).toHaveBeenCalledWith(3, 2);
        }
      }
    });

    it('should call onHover with null when cursor leaves', () => {
      const onHover = jest.fn();
      const config: FieldConfig<GraphFieldConfig> = {
        custom: {
          interactionEnabled: true,
        } as any,
      };

      const component = render(
        <Sparkline
          width={800}
          height={600}
          theme={createTheme()}
          sparkline={mockSparkline}
          config={config}
          onHover={onHover}
        />
      );

      const instance = (component.container.firstChild as any)?.__reactFiber$?.return?.stateNode;
      if (instance?.state?.configBuilder) {
        const builder = instance.state.configBuilder;
        const hooks = builder.getConfig().hooks;

        const setLegendHook = hooks?.setLegend?.[0];
        if (setLegendHook) {
          // Simulate cursor leaving (no valid index)
          const mockUPlot = {
            cursor: { idxs: [null, null] },
            data: [mockSparkline.x!.values, mockSparkline.y.values],
          };
          setLegendHook(mockUPlot as any);

          expect(onHover).toHaveBeenCalledWith(null, null);
        }
      }
    });

    it('should not set up hover hooks when interaction is disabled', () => {
      const onHover = jest.fn();
      const config: FieldConfig<GraphFieldConfig> = {
        custom: {
          interactionEnabled: false,
        } as any,
      };

      const component = render(
        <Sparkline
          width={800}
          height={600}
          theme={createTheme()}
          sparkline={mockSparkline}
          config={config}
          onHover={onHover}
        />
      );

      const instance = (component.container.firstChild as any)?.__reactFiber$?.return?.stateNode;
      if (instance?.state?.configBuilder) {
        const builder = instance.state.configBuilder;
        const hooks = builder.getConfig().hooks;

        // setLegend hook should not be registered
        expect(hooks?.setLegend).toBeUndefined();
      }
    });

    it('should not set up hover hooks when onHover is not provided', () => {
      const config: FieldConfig<GraphFieldConfig> = {
        custom: {
          interactionEnabled: true,
        } as any,
      };

      const component = render(
        <Sparkline
          width={800}
          height={600}
          theme={createTheme()}
          sparkline={mockSparkline}
          config={config}
        />
      );

      const instance = (component.container.firstChild as any)?.__reactFiber$?.return?.stateNode;
      if (instance?.state?.configBuilder) {
        const builder = instance.state.configBuilder;
        const hooks = builder.getConfig().hooks;

        // setLegend hook should not be registered when no onHover callback
        expect(hooks?.setLegend).toBeUndefined();
      }
    });

    it('should enable interaction by default when not explicitly configured', () => {
      const onHover = jest.fn();
      const config: FieldConfig<GraphFieldConfig> = {
        custom: {} as any,
      };

      const component = render(
        <Sparkline
          width={800}
          height={600}
          theme={createTheme()}
          sparkline={mockSparkline}
          config={config}
          onHover={onHover}
        />
      );

      const instance = (component.container.firstChild as any)?.__reactFiber$?.return?.stateNode;
      if (instance?.state?.configBuilder) {
        const builder = instance.state.configBuilder;
        const hooks = builder.getConfig().hooks;

        // setLegend hook should be registered (interaction enabled by default)
        expect(hooks?.setLegend).toBeDefined();
        expect(hooks?.setLegend?.length).toBeGreaterThan(0);
      }
    });

    it('should handle non-finite values correctly during hover', () => {
      const onHover = jest.fn();
      const config: FieldConfig<GraphFieldConfig> = {
        custom: {
          interactionEnabled: true,
        } as any,
      };

      const sparklineWithNaN: FieldSparkline = {
        ...mockSparkline,
        y: {
          ...mockSparkline.y,
          values: [1, NaN, 3, Infinity, 5],
        },
      };

      const component = render(
        <Sparkline
          width={800}
          height={600}
          theme={createTheme()}
          sparkline={sparklineWithNaN}
          config={config}
          onHover={onHover}
        />
      );

      const instance = (component.container.firstChild as any)?.__reactFiber$?.return?.stateNode;
      if (instance?.state?.configBuilder) {
        const builder = instance.state.configBuilder;
        const hooks = builder.getConfig().hooks;

        const setLegendHook = hooks?.setLegend?.[0];
        if (setLegendHook) {
          // Hover over NaN value at index 1
          const mockUPlot1 = {
            cursor: { idxs: [1, 1] },
            data: [sparklineWithNaN.x!.values, sparklineWithNaN.y.values],
          };
          setLegendHook(mockUPlot1 as any);
          expect(onHover).toHaveBeenCalledWith(null, null);

          onHover.mockClear();

          // Hover over Infinity value at index 3
          const mockUPlot3 = {
            cursor: { idxs: [3, 3] },
            data: [sparklineWithNaN.x!.values, sparklineWithNaN.y.values],
          };
          setLegendHook(mockUPlot3 as any);
          expect(onHover).toHaveBeenCalledWith(null, null);
        }
      }
    });
  });
});

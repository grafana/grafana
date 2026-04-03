import { AxisPlacement, GraphDrawStyle, VisibilityMode } from '@grafana/schema';
import { LegendDisplayMode, TooltipDisplayMode } from '@grafana/ui';

import { timeRulerVizConfig } from './TimeRulerStrip';

describe('timeRulerVizConfig', () => {
  const fieldConfig = timeRulerVizConfig.fieldConfig;
  const defaults = fieldConfig.defaults;
  const customDefaults = defaults.custom!;
  const options = timeRulerVizConfig.options;
  const overrides = fieldConfig.overrides;

  it('should not render any visible data', () => {
    expect(customDefaults.drawStyle).toBe(GraphDrawStyle.Line);
    expect(customDefaults.lineWidth).toBe(0);
    expect(customDefaults.showPoints).toBe(VisibilityMode.Never);
    expect(customDefaults.fillOpacity).toBe(0);
    expect(customDefaults.hideFrom).toEqual({ legend: true, tooltip: true, viz: true });
  });

  it('should hide Y-axis only via Value field override, leaving time axis visible', () => {
    expect(customDefaults.axisPlacement).toBeUndefined();

    const valueOverride = overrides.find((o) => o.matcher.id === 'byName' && o.matcher.options === 'Value');
    expect(valueOverride).toBeDefined();

    const axisPlacementProp = valueOverride!.properties.find((p) => p.id === 'custom.axisPlacement');
    expect(axisPlacementProp?.value).toBe(AxisPlacement.Hidden);

    const axisGridProp = valueOverride!.properties.find((p) => p.id === 'custom.axisGridShow');
    expect(axisGridProp?.value).toBe(false);
  });

  it('should hide legend and tooltip', () => {
    expect(options.legend!.showLegend).toBe(false);
    expect(options.legend!.displayMode).toBe(LegendDisplayMode.Hidden);
    expect(options.tooltip!.mode).toBe(TooltipDisplayMode.None);
  });
});

import { useCallback } from 'react';

import { DataFrame, FALLBACK_COLOR, FieldType, TimeRange } from '@grafana/data';
import { TimelineValueAlignment, TooltipDisplayMode, VisibilityMode, VizTooltipOptions } from '@grafana/schema';
import { UPlotConfigBuilder, VizLayout, VizLegend, VizLegendItem } from '@grafana/ui';

import { GraphNG, GraphNGProps } from '../GraphNG/GraphNG';
import { getXAxisConfig } from '../TimeSeries/utils';

import { preparePlotConfigBuilder, TimelineMode } from './utils';

/**
 * @alpha
 */
export interface TimelineProps extends Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend'> {
  mode: TimelineMode;
  rowHeight?: number;
  showValue: VisibilityMode;
  alignValue?: TimelineValueAlignment;
  colWidth?: number;
  legendItems?: VizLegendItem[];
  tooltip?: VizTooltipOptions;
  // Whenever `paginationRev` changes, the graph will be fully re-configured/rendered.
  paginationRev?: string;
}

const propsToDiff = [
  'rowHeight',
  'colWidth',
  'showValue',
  'mergeValues',
  'alignValue',
  'tooltip',
  'paginationRev',
  'annotationLanes',
];

const FEATURE_TOGGLE_ENABLED = true;

/**
 * Hashes a string to generate a consistent, visually distinct color.
 * Optimized for at least 32 distinct colors with varying hue and brightness.
 *
 * @param str - The string to hash into a color
 * @returns A hex color string (e.g., "#3498db")
 */
function hashStringToColor(str: string): string {
  // Simple hash function to convert string to a number
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use the hash to generate distinct hue values
  // Distribute across the full 360° color wheel for maximum distinction
  const hue = Math.abs(hash % 360);

  // Create two alternating brightness levels for better distinction
  // This effectively doubles our color space
  const lightnessVariant = Math.abs(Math.floor(hash / 360) % 2);
  const lightness = lightnessVariant === 0 ? 45 : 65; // Darker or lighter variant

  // Use moderate saturation for good visibility
  // Vary saturation slightly based on hash for additional distinction
  const saturationVariant = Math.abs(Math.floor(hash / 720) % 3);
  const saturation = 65 + saturationVariant * 10; // 65%, 75%, or 85%

  // Convert HSL to RGB
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l; // Achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) {
        t += 1;
      }
      if (t > 1) {
        t -= 1;
      }
      if (t < 1 / 6) {
        return p + (q - p) * 6 * t;
      }
      if (t < 1 / 2) {
        return q;
      }
      if (t < 2 / 3) {
        return p + (q - p) * (2 / 3 - t) * 6;
      }
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  // Convert to hex
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export const TimelineChart = (props: TimelineProps) => {
  const { frames, timeZone, rowHeight, tooltip, legend, legendItems } = props;

  const getValueColor = useCallback(
    (frameIdx: number, fieldIdx: number, value: unknown) => {
      const field = frames[frameIdx]?.fields[fieldIdx];

      if (FEATURE_TOGGLE_ENABLED && field?.config?.color?.mode === 'palette-classic') {
        const valueAsString = typeof value === 'string' ? value : String(value);
        const hashedColor = hashStringToColor(valueAsString);
        return hashedColor;
      }

      if (field?.display) {
        const disp = field.display(value); // will apply color modes
        if (disp.color) {
          return disp.color;
        }
      }

      return FALLBACK_COLOR;
    },
    [frames]
  );

  const prepConfig = useCallback(
    (alignedFrame: DataFrame, allFrames: DataFrame[], getTimeRange: () => TimeRange) => {
      return preparePlotConfigBuilder({
        frame: alignedFrame,
        getTimeRange,
        allFrames: frames,
        ...props,

        // Ensure timezones is passed as an array
        timeZones: Array.isArray(timeZone) ? timeZone : [timeZone],

        // When there is only one row, use the full space
        rowHeight: alignedFrame.fields.length > 2 ? rowHeight : 1,
        getValueColor: getValueColor,

        hoverMulti: tooltip?.mode === TooltipDisplayMode.Multi,
        xAxisConfig: getXAxisConfig(props.annotationLanes),
      });
    },
    [frames, props, timeZone, rowHeight, getValueColor, tooltip]
  );

  const renderLegend = useCallback(
    (config: UPlotConfigBuilder) => {
      if (!config || !legendItems || !legend || legend.showLegend === false) {
        return null;
      }

      return (
        <VizLayout.Legend placement={legend.placement}>
          <VizLegend placement={legend.placement} items={legendItems} displayMode={legend.displayMode} readonly />
        </VizLayout.Legend>
      );
    },
    [legend, legendItems]
  );

  return (
    <GraphNG
      {...props}
      fields={{
        x: (f) => f.type === FieldType.time,
        y: (f) =>
          f.type === FieldType.number ||
          f.type === FieldType.boolean ||
          f.type === FieldType.string ||
          f.type === FieldType.enum,
      }}
      prepConfig={prepConfig}
      propsToDiff={propsToDiff}
      renderLegend={renderLegend}
      omitHideFromViz={true}
    />
  );
};

import { config } from '@grafana/runtime';
import { TextDimensionMode } from '@grafana/schema';

import { getMarkerMaker } from './markers';
import {
  HorizontalAlign,
  VerticalAlign,
  defaultStyleConfig,
  StyleConfig,
  StyleConfigFields,
  StyleConfigState,
  SymbolAlign,
  ColorValue,
} from './types';

/** Indicate if the style wants to show text values */
export function styleUsesText(config: StyleConfig): boolean {
  const text = config?.text;
  if (!text) {
    return false;
  }
  if (text.mode === TextDimensionMode.Fixed && text.fixed?.length) {
    return true;
  }
  if (text.mode === TextDimensionMode.Field && text.field?.length) {
    return true;
  }
  return false;
}

/** Return a distinct list of fields used to dynamically change the style */
export async function getStyleConfigState(cfg?: StyleConfig): Promise<StyleConfigState> {
  if (!cfg) {
    cfg = defaultStyleConfig;
  }
  const hasText = styleUsesText(cfg);
  const fields: StyleConfigFields = {};
  const maker = await getMarkerMaker(cfg.symbol?.fixed, hasText);
  const state: StyleConfigState = {
    config: cfg, // raw values
    hasText,
    fields,
    base: {
      color: config.theme2.visualization.getColorByName(cfg.color?.fixed ?? defaultStyleConfig.color.fixed),
      opacity: cfg.opacity ?? defaultStyleConfig.opacity,
      lineWidth: cfg.lineWidth ?? 1,
      size: cfg.size?.fixed ?? defaultStyleConfig.size.fixed,
      rotation: cfg.rotation?.fixed ?? defaultStyleConfig.rotation.fixed, // add ability follow path later
      symbolAlign: cfg.symbolAlign ?? defaultStyleConfig.symbolAlign,
    },
    maker,
  };

  if (cfg.color?.field?.length) {
    fields.color = cfg.color.field;
  }
  if (cfg.size?.field?.length) {
    fields.size = cfg.size.field;
  }
  if (cfg.rotation?.field?.length) {
    fields.rotation = cfg.rotation.field;
  }

  if (hasText) {
    state.base.text = cfg.text?.fixed;
    state.base.textConfig = cfg.textConfig ?? defaultStyleConfig.textConfig;

    if (cfg.text?.field?.length) {
      fields.text = cfg.text.field;
    }
  }

  // Clear the fields if possible
  if (!Object.keys(fields).length) {
    state.fields = undefined;
  }
  return state;
}

/** Return a displacment array depending on alignment and icon radius */
export function getDisplacement(symbolAlign: SymbolAlign, radius: number) {
  const displacement = [0, 0];
  if (symbolAlign?.horizontal === HorizontalAlign.Left) {
    displacement[0] = -radius;
  } else if (symbolAlign?.horizontal === HorizontalAlign.Right) {
    displacement[0] = radius;
  }
  if (symbolAlign?.vertical === VerticalAlign.Top) {
    displacement[1] = radius;
  } else if (symbolAlign?.vertical === VerticalAlign.Bottom) {
    displacement[1] = -radius;
  }
  return displacement;
}

export function getRGBValues(colorString: string): ColorValue | null {
  // Check if it's a hex color
  if (colorString.startsWith('#')) {
    return getRGBFromHex(colorString);
  }

  // Check if it's an RGB color
  else if (colorString.startsWith('rgb')) {
    return getRGBFromRGBString(colorString);
  }

  // Handle other color formats if needed
  else {
    console.warn(`Unsupported color format: ${colorString}`);
  }
  return null;
}

function getRGBFromHex(hexColor: string): ColorValue {
  // Remove the '#' character
  hexColor = hexColor.slice(1);

  // Convert hex to decimal values
  const r = parseInt(hexColor.slice(0, 2), 16);
  const g = parseInt(hexColor.slice(2, 4), 16);
  const b = parseInt(hexColor.slice(4, 6), 16);

  return { r, g, b };
}

function getRGBFromRGBString(rgbString: string): ColorValue | null {
  // Use regex to extract the numbers, supporting both rgb(r,g,b) and rgba(r,g,b,a) formats
  const matches = rgbString.match(/\d+\.?\d*/g);

  if (matches) {
    if (matches.length === 3) {
      return {
        r: parseInt(matches[0], 10),
        g: parseInt(matches[1], 10),
        b: parseInt(matches[2], 10),
      };
    } else if (matches.length === 4) {
      return {
        r: parseInt(matches[0], 10),
        g: parseInt(matches[1], 10),
        b: parseInt(matches[2], 10),
        a: parseFloat(matches[3]), // Using parseFloat for alpha as it can be decimal (0-1)
      };
    } else {
      console.warn(`Unsupported color format: ${rgbString}`);
    }
  } else {
    console.warn(`Unsupported color format: ${rgbString}`);
  }
  return null;
}

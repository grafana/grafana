import tinycolor from 'tinycolor2';

import { DisplayProcessor, FALLBACK_COLOR, FieldDisplay, getFieldColorMode, GrafanaTheme2 } from '@grafana/data';

import { RadialGradientMode, RadialShape } from './RadialGauge';
import { GaugeDimensions } from './utils';

export interface RadialColorDefsOptions {
  gradient: RadialGradientMode;
  fieldDisplay: FieldDisplay;
  theme: GrafanaTheme2;
  dimensions: GaugeDimensions;
  shape: RadialShape;
  gaugeId: string;
  displayProcessor: DisplayProcessor;
}

// eslint-disable-next-line react-prefer-function-component/react-prefer-function-component
export class RadialColorDefs {
  private colorToIds: Record<string, string> = {};
  private defs: React.ReactNode[] = [];

  constructor(private options: RadialColorDefsOptions) {}

  getSegmentColor(forValue: number): string {
    const { displayProcessor } = this.options;
    const baseColor = displayProcessor(forValue).color ?? FALLBACK_COLOR;

    return this.getColor(baseColor, true);
  }

  getColor(baseColor: string, forSegment?: boolean): string {
    const { gradient, dimensions, gaugeId, fieldDisplay, shape, theme } = this.options;

    const id = `value-color-${baseColor}-${gaugeId}`;

    if (this.colorToIds[id]) {
      return this.colorToIds[id];
    }

    // If no gradient, just return the base color
    if (gradient === 'none') {
      this.colorToIds[id] = baseColor;
      return baseColor;
    }

    const returnColor = (this.colorToIds[id] = `url(#${id})`);
    const colorModeId = fieldDisplay.field.color?.mode;
    const colorMode = getFieldColorMode(colorModeId);
    const valuePercent = fieldDisplay.display.percent ?? 0;

    // Handle continusous color modes first
    // If it's a segment color we don't want to do continuous gradients
    if (colorMode.isContinuous && colorMode.getColors && !forSegment) {
      const colors = colorMode.getColors(theme);
      const count = colors.length;

      this.defs.push(
        <linearGradient x1="0" y1="0" x2={1 / valuePercent} y2="0" id={id}>
          {colors.map((stopColor, i) => (
            <stop key={i} offset={`${(i / (count - 1)).toFixed(2)}`} stopColor={stopColor} stopOpacity={1} />
          ))}
        </linearGradient>
      );

      return returnColor;
    }

    // For value based colors we want to stay more true to the specific color
    // So a radial gradient that adds a bit of light and shade works best
    if (colorMode.isByValue) {
      const color1 = tinycolor(baseColor).darken(5);

      this.defs.push(
        <radialGradient
          key={id}
          id={id}
          cx={dimensions.centerX}
          cy={dimensions.centerY}
          r={dimensions.radius + dimensions.barWidth / 2}
          fr={dimensions.radius - dimensions.barWidth / 2}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={tinycolor(baseColor).spin(20).lighten(10).toString()} stopOpacity={1} />
          <stop offset="60%" stopColor={color1.toString()} stopOpacity={1} />
          <stop offset="100%" stopColor={color1.toString()} stopOpacity={1} />
        </radialGradient>
      );

      return returnColor;
    }

    // For fixed / palette based color scales we can create a more fun
    // hue and light based linear gradient that we rotate/move with the value

    const x2 = shape === 'circle' ? 0 : dimensions.centerX + dimensions.radius;
    const y2 = shape === 'circle' ? dimensions.centerY + dimensions.radius : 0;
    const color1 = tinycolor(baseColor).spin(-20).darken(5);
    const color2 = tinycolor(baseColor).saturate(20).spin(20).brighten(10);

    // this makes it so the gradient is always brightest at the current value
    const transform =
      shape === 'circle'
        ? `rotate(${360 * valuePercent - 180} ${dimensions.centerX} ${dimensions.centerY})`
        : `translate(-${dimensions.radius * 2 * (1 - valuePercent)}, 0)`;

    this.defs.push(
      <linearGradient
        key={id}
        id={id}
        x1="0"
        y1="0"
        x2={x2}
        y2={y2}
        gradientUnits="userSpaceOnUse"
        gradientTransform={transform}
      >
        {theme.isDark ? (
          <>
            <stop offset="0%" stopColor={color1.darken(10).toString()} stopOpacity={1} />
            <stop offset="100%" stopColor={color2.lighten(10).toString()} stopOpacity={1} />
          </>
        ) : (
          <>
            <stop offset="0%" stopColor={color2.lighten(10).toString()} stopOpacity={1} />
            <stop offset="100%" stopColor={color1.toString()} stopOpacity={1} />
          </>
        )}
      </linearGradient>
    );

    return returnColor;
  }

  getMainBarColor(): string {
    return this.getColor(this.options.fieldDisplay.display.color ?? FALLBACK_COLOR);
  }

  getDefs(): React.ReactNode[] {
    return this.defs;
  }
}

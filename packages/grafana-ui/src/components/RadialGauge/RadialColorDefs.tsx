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

export class RadialColorDefs {
  private colorToIds: Record<string, string> = {};
  private defs: React.ReactNode[] = [];

  constructor(private options: RadialColorDefsOptions) {}

  private getBaseColor(forValue?: number): string {
    const { fieldDisplay, displayProcessor } = this.options;

    if (forValue === undefined && fieldDisplay.display.color) {
      return fieldDisplay.display.color ?? FALLBACK_COLOR;
    }

    return displayProcessor(forValue).color ?? FALLBACK_COLOR;
  }

  getColor(forValue?: number): string {
    const { theme, gradient, dimensions, shape, fieldDisplay, gaugeId } = this.options;
    const baseColor = this.getBaseColor(forValue);

    if (this.colorToIds[baseColor]) {
      return this.colorToIds[baseColor];
    }

    // If no gradient, just return the base color
    if (gradient === 'none') {
      this.colorToIds[baseColor] = baseColor;
      return baseColor;
    }

    const colorModeId = fieldDisplay.field.color?.mode;
    const colorMode = getFieldColorMode(colorModeId);
    const id = `bar-color-${baseColor}-${gaugeId}`;
    const valuePercent = fieldDisplay.display.percent ?? 0;
    const x2 = shape === 'circle' ? 0 : dimensions.centerX + dimensions.radius;
    const y2 = shape === 'circle' ? dimensions.centerY + dimensions.radius : 0;

    const transform =
      shape === 'circle'
        ? `rotate(${360 * valuePercent - 180} ${dimensions.centerX} ${dimensions.centerY})`
        : `translate(-${dimensions.radius * 2 * (1 - valuePercent)}, 0)`;

    const returnColor = (this.colorToIds[baseColor] = `url(#${id})`);

    // If gradient set to shade we don't care about the colorMode
    // It will just shade the base color
    if (gradient === 'shade') {
      const color1 = tinycolor(baseColor).darken(5);

      // this.defs.push(
      //   <linearGradient
      //     x1="0"
      //     y1="0"
      //     x2={x2}
      //     y2={y2}
      //     id={id}
      //     gradientUnits="userSpaceOnUse"
      //     gradientTransform={transform}
      //   >
      //     <stop offset="0%" stopColor={color1.toString()} stopOpacity={1} />
      //     <stop offset="100%" stopColor={tinycolor(baseColor).lighten(15).toString()} stopOpacity={1} />
      //   </linearGradient>
      // );

      this.defs.push(
        <radialGradient
          cx={dimensions.centerX}
          cy={dimensions.centerY}
          r={dimensions.radius + dimensions.barWidth / 2}
          fr={dimensions.radius - dimensions.barWidth / 2}
          id={id}
          gradientUnits="userSpaceOnUse"
          //gradientTransform={transform}
        >
          <stop offset="0%" stopColor={tinycolor(baseColor).lighten(20).toString()} stopOpacity={1} />
          <stop offset="50%" stopColor={color1.toString()} stopOpacity={1} />
          <stop offset="100%" stopColor={color1.toString()} stopOpacity={1} />
        </radialGradient>
      );

      return returnColor;
    }

    // Hue is a bit more complex because we need to consider the color scheme. / color mode
    // If color scheme is continuous we build a gradient from getColors
    // If color scheme is thresholds we build a gradient from the threshold colors
    if (gradient === 'hue') {
      if (colorMode.isContinuous && colorMode.getColors) {
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

      const color1 = tinycolor(baseColor).spin(-20).darken(5);
      const color2 = tinycolor(baseColor).saturate(20).spin(20).brighten(10);

      this.defs.push(
        <linearGradient
          x1="0"
          y1="0"
          x2={x2}
          y2={y2}
          id={id}
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
    }

    return returnColor;
  }

  getDefs(): React.ReactNode[] {
    return this.defs;
  }
}

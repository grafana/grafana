import tinycolor from 'tinycolor2';

import { FieldDisplay, GrafanaTheme2, getFieldColorMode } from '@grafana/data';

import { RadialGradientMode, RadialShape } from './RadialGauge';

interface GradientDefProps {
  fieldDisplay: FieldDisplay;
  index: number;
  theme: GrafanaTheme2;
  gaugeId: string;
  gradient: RadialGradientMode;
  width: number;
  height: number;
  shape: RadialShape;
  center: number;
}

export function GradientDef({
  fieldDisplay,
  index,
  theme,
  gaugeId,
  gradient,
  width,
  height,
  shape,
  center,
}: GradientDefProps) {
  const colorModeId = fieldDisplay.field.color?.mode;
  const valuePercent = fieldDisplay.display.percent ?? 0;
  const colorMode = getFieldColorMode(colorModeId);

  switch (gradient) {
    case 'shade': {
      const color = fieldDisplay.display.color ?? 'gray';
      const color1 = tinycolor(color).darken(5);

      return (
        <linearGradient x1="0" y1="1" x2="1" y2="1" id={getGradientId(gaugeId, index)}>
          <stop offset="0%" stopColor={color1.toString()} stopOpacity={1} />
          <stop offset="50%" stopColor={tinycolor(color).lighten(15).toString()} stopOpacity={1} />
          <stop offset="53%" stopColor={tinycolor(color).lighten(15).toString()} stopOpacity={1} />
          <stop offset="90%" stopColor={color} stopOpacity={1} />
        </linearGradient>
      );
    }
    case 'scheme': {
      if (colorMode.isContinuous && colorMode.getColors) {
        const colors = colorMode.getColors(theme);
        const count = colors.length;

        return (
          <linearGradient x1="0" y1="1" x2={1 / valuePercent} y2="1" id={getGradientId(gaugeId, index)}>
            {colors.map((stopColor, i) => (
              <stop key={i} offset={`${(i / (count - 1)).toFixed(2)}`} stopColor={stopColor} stopOpacity={1}></stop>
            ))}
          </linearGradient>
        );
      }

      return null;
    }
    case 'hue': {
      const color = fieldDisplay.display.color ?? 'gray';
      const color1 = tinycolor(color).spin(-20).darken(5);
      const color2 = tinycolor(color).saturate(20).spin(20).brighten(10);
      const percent = fieldDisplay.display.percent ?? 0;
      const x2 = shape === 'circle' ? 0 : width;
      const y2 = shape === 'circle' ? height : 0;

      // this makes it so the gradient is always brightest at the current value
      const transform =
        shape === 'circle'
          ? `rotate(${360 * percent - 180} ${center} ${center})`
          : `translate(-${width * (1 - percent)}, 0)`;

      return (
        <linearGradient
          x1="0"
          y1="0"
          x2={x2}
          y2={y2}
          id={getGradientId(gaugeId, index)}
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
  }

  return null;
}

export function getGradientId(gaugeId: string, index: number) {
  return `radial-gauge-${gaugeId}-${index}`;
}

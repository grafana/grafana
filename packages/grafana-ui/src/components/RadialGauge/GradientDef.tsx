import tinycolor from 'tinycolor2';

import { FieldDisplay, GrafanaTheme2, getFieldColorMode } from '@grafana/data';

import { RadialGradientMode, RadialShape } from './RadialGauge';
import { GaugeDimensions } from './utils';

interface GradientDefProps {
  fieldDisplay: FieldDisplay;
  id: string;
  theme: GrafanaTheme2;
  gradient: RadialGradientMode;
  dimensions: GaugeDimensions;
  shape: RadialShape;
}

export function GradientDef({ fieldDisplay, id, theme, gradient, dimensions, shape }: GradientDefProps) {
  const colorModeId = fieldDisplay.field.color?.mode;
  const valuePercent = fieldDisplay.display.percent ?? 0;
  const colorMode = getFieldColorMode(colorModeId);
  const x2 = shape === 'circle' ? 0 : dimensions.centerX + dimensions.radius;
  const y2 = shape === 'circle' ? dimensions.centerY + dimensions.radius : 0;

  // this makes it so the gradient is always brightest at the current value
  const transform =
    shape === 'circle'
      ? `rotate(${360 * valuePercent - 180} ${dimensions.centerX} ${dimensions.centerY})`
      : `translate(-${dimensions.radius * 2 * (1 - valuePercent)}, 0)`;

  switch (gradient) {
    case 'shade': {
      const color = fieldDisplay.display.color ?? 'gray';
      const color1 = tinycolor(color).darken(5);

      return (
        <linearGradient
          x1="0"
          y1="0"
          x2={x2}
          y2={y2}
          id={id}
          gradientUnits="userSpaceOnUse"
          gradientTransform={transform}
        >
          <stop offset="0%" stopColor={color1.toString()} stopOpacity={1} />
          <stop offset="100%" stopColor={tinycolor(color).lighten(15).toString()} stopOpacity={1} />
        </linearGradient>
      );
    }
    case 'hue': {
      const color = fieldDisplay.display.color ?? 'gray';
      const color1 = tinycolor(color).spin(-20).darken(5);
      const color2 = tinycolor(color).saturate(20).spin(20).brighten(10);

      return (
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
    case 'scheme': {
      if (colorMode.getColors) {
        const colors = colorMode.getColors(theme);
        const count = colors.length;

        return (
          <linearGradient x1="0" y1="0" x2={1 / valuePercent} y2="0" id={id}>
            {colors.map((stopColor, i) => (
              <stop key={i} offset={`${(i / (count - 1)).toFixed(2)}`} stopColor={stopColor} stopOpacity={1} />
            ))}
          </linearGradient>
        );
      } else {
        return (
          <linearGradient x1="0" y1="1" x2={0} y2="1" id={id}>
            <stop stopColor={fieldDisplay.display.color ?? 'gray'} stopOpacity={1} />
          </linearGradient>
        );
      }
    }
    // case 'radial': {
    // const color = fieldDisplay.display.color ?? 'gray';
    //  const color1 = tinycolor(color).darken(5);
    //     <radialGradient
    //       cx={center}
    //       cy={center}
    //       r={radius + barWidth / 2}
    //       fr={radius - barWidth / 2}
    //       id={getGradientId(gaugeId, index)}
    //       gradientUnits="userSpaceOnUse"
    //       //gradientTransform={transform}
    //     >
    //       <stop offset="0%" stopColor={tinycolor(color).lighten(20).toString()} stopOpacity={1} />
    //       <stop offset="100%" stopColor={color1.toString()} stopOpacity={1} />
    //     </radialGradient>
    // }
  }

  return null;
}

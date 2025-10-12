import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

import { RadialArcPath } from './RadialArcPath';
import { RadialColorDefs } from './RadialColorDefs';
import { GaugeDimensions, toRad } from './utils';

export interface RadialBarProps {
  dimensions: GaugeDimensions;
  colorDefs: RadialColorDefs;
  angleRange: number;
  angle: number;
  startAngle: number;
  roundedBars?: boolean;
  spotlightStroke: string;
  glowFilter?: string;
}
export function RadialBar({
  dimensions,
  colorDefs,
  angleRange,
  angle,
  startAngle,
  roundedBars,
  spotlightStroke,
  glowFilter,
}: RadialBarProps) {
  const theme = useTheme2();

  return (
    <>
      <g>
        {/** Track */}
        <RadialArcPath
          startAngle={startAngle + angle}
          dimensions={dimensions}
          arcLengthDeg={angleRange - angle}
          color={theme.colors.action.hover}
          roundedBars={roundedBars}
        />
        {/** The colored bar */}
        <RadialArcPath
          dimensions={dimensions}
          startAngle={startAngle}
          arcLengthDeg={angle}
          color={colorDefs.getMainBarColor()}
          roundedBars={roundedBars}
          glowFilter={glowFilter}
        />
        {spotlightStroke && angle > 8 && (
          <SpotlightSquareEffect
            dimensions={dimensions}
            angle={startAngle + angle}
            glowFilter={glowFilter}
            spotlightStroke={spotlightStroke}
            theme={theme}
            roundedBars={roundedBars}
          />
        )}
      </g>
      <defs>{colorDefs.getDefs()}</defs>
    </>
  );
}

interface SpotlightEffectProps {
  dimensions: GaugeDimensions;
  angle: number;
  glowFilter?: string;
  spotlightStroke: string;
  theme: GrafanaTheme2;
  roundedBars?: boolean;
}

function SpotlightSquareEffect({ dimensions, angle, glowFilter, spotlightStroke, roundedBars }: SpotlightEffectProps) {
  const { radius, centerX, centerY, barWidth } = dimensions;

  const angleRadian = toRad(angle);
  const x1 = centerX + radius * Math.cos(angleRadian - 0.2);
  const y1 = centerY + radius * Math.sin(angleRadian - 0.2);
  const x2 = centerX + radius * Math.cos(angleRadian);
  const y2 = centerY + radius * Math.sin(angleRadian);

  const path = ['M', x1, y1, 'A', radius, radius, 0, 0, 1, x2, y2].join(' ');

  return (
    <path
      d={path}
      fill="none"
      strokeWidth={barWidth}
      stroke={spotlightStroke}
      strokeLinecap={roundedBars ? 'round' : 'butt'}
      filter={glowFilter}
    />
  );
}

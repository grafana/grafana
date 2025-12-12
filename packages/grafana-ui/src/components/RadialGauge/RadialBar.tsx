import { useTheme2 } from '../../themes/ThemeContext';

import { RadialArcPath } from './RadialArcPath';
import { RadialColorDefs } from './RadialColorDefs';
import { GaugeDimensions } from './utils';

export interface RadialBarProps {
  dimensions: GaugeDimensions;
  colorDefs: RadialColorDefs;
  angleRange: number;
  angle: number;
  startAngle: number;
  roundedBars?: boolean;
  glowFilter?: string;
}
export function RadialBar({
  dimensions,
  colorDefs,
  angleRange,
  angle,
  startAngle,
  roundedBars,
  glowFilter,
}: RadialBarProps) {
  const theme = useTheme2();
  const [startDotColor, endDotColor] = colorDefs.getGuideDotColors();

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
          showGuideDots={roundedBars}
          guideDotStartColor={startDotColor}
          guideDotEndColor={endDotColor}
        />
      </g>
      <defs>{colorDefs.getDefs()}</defs>
    </>
  );
}

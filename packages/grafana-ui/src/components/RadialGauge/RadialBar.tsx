import { useTheme2 } from '../../themes/ThemeContext';

import { RadialArcPath } from './RadialArcPath';
import { RadialColorDefs } from './RadialColorDefs';
import { RadialShape } from './RadialGauge';
import { GaugeDimensions } from './utils';

export interface RadialBarProps {
  dimensions: GaugeDimensions;
  colorDefs: RadialColorDefs;
  angleRange: number;
  angle: number;
  startAngle: number;
  roundedBars?: boolean;
  glowFilter?: string;
  shape: RadialShape;
}
export function RadialBar({
  dimensions,
  colorDefs,
  angleRange,
  angle,
  startAngle,
  roundedBars,
  glowFilter,
  shape,
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
          colorDefs={colorDefs}
          color={theme.colors.action.hover}
          roundedBars={roundedBars}
          shape={shape}
        />
        {/** The colored bar */}
        <RadialArcPath
          dimensions={dimensions}
          startAngle={startAngle}
          arcLengthDeg={angle}
          colorDefs={colorDefs}
          gradient={colorDefs.getGradientDef()}
          roundedBars={roundedBars}
          glowFilter={glowFilter}
          showGuideDots={roundedBars}
          guideDotStartColor={startDotColor}
          guideDotEndColor={endDotColor}
          shape={shape}
        />
      </g>
      <defs>{colorDefs.getDefs()}</defs>
    </>
  );
}

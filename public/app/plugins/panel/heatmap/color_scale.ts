import * as d3Scale from 'd3-scale';
import * as d3ScaleChromatic from 'd3-scale-chromatic';

export function getColorScale(colorScheme: any, lightTheme: boolean, maxValue: number, minValue = 0): (d: any) => any {
  let colorInterpolator = d3ScaleChromatic[colorScheme.value];
  let colorScaleInverted = colorScheme.invert === 'always' ||
    (colorScheme.invert === 'dark' && !lightTheme);

  let start = colorScaleInverted ? maxValue : minValue;
  let end = colorScaleInverted ? minValue : maxValue;

  return d3Scale.scaleSequential(colorInterpolator).domain([start, end]);
}

export function getOpacityScale(options, maxValue, minValue = 0) {
  let legendOpacityScale;
  if (options.colorScale === 'linear') {
    legendOpacityScale = d3Scale.scaleLinear()
    .domain([minValue, maxValue])
    .range([0, 1]);
  } else if (options.colorScale === 'sqrt') {
    legendOpacityScale = d3Scale.scalePow().exponent(options.exponent)
    .domain([minValue, maxValue])
    .range([0, 1]);
  }
  return legendOpacityScale;
}

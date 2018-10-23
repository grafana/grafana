import * as d3 from 'd3';
import * as d3ScaleChromatic from 'd3-scale-chromatic';

export function getColorScale(colorScheme: any, lightTheme: boolean, maxValue: number, minValue = 0): (d: any) => any {
  const colorInterpolator = d3ScaleChromatic[colorScheme.value];
  const colorScaleInverted = colorScheme.invert === 'always' || colorScheme.invert === (lightTheme ? 'light' : 'dark');

  const start = colorScaleInverted ? maxValue : minValue;
  const end = colorScaleInverted ? minValue : maxValue;

  return d3.scaleSequential(colorInterpolator).domain([start, end]);
}

export function getOpacityScale(options, maxValue, minValue = 0) {
  let legendOpacityScale;
  if (options.colorScale === 'linear') {
    legendOpacityScale = d3
      .scaleLinear()
      .domain([minValue, maxValue])
      .range([0, 1]);
  } else if (options.colorScale === 'sqrt') {
    legendOpacityScale = d3
      .scalePow()
      .exponent(options.exponent)
      .domain([minValue, maxValue])
      .range([0, 1]);
  }
  return legendOpacityScale;
}

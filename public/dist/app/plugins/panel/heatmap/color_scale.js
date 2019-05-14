import * as d3 from 'd3';
import * as d3ScaleChromatic from 'd3-scale-chromatic';
export function getColorScale(colorScheme, lightTheme, maxValue, minValue) {
    if (minValue === void 0) { minValue = 0; }
    var colorInterpolator = d3ScaleChromatic[colorScheme.value];
    var colorScaleInverted = colorScheme.invert === 'always' || colorScheme.invert === (lightTheme ? 'light' : 'dark');
    var start = colorScaleInverted ? maxValue : minValue;
    var end = colorScaleInverted ? minValue : maxValue;
    return d3.scaleSequential(colorInterpolator).domain([start, end]);
}
export function getOpacityScale(options, maxValue, minValue) {
    if (minValue === void 0) { minValue = 0; }
    var legendOpacityScale;
    if (options.colorScale === 'linear') {
        legendOpacityScale = d3
            .scaleLinear()
            .domain([minValue, maxValue])
            .range([0, 1]);
    }
    else if (options.colorScale === 'sqrt') {
        legendOpacityScale = d3
            .scalePow()
            .exponent(options.exponent)
            .domain([minValue, maxValue])
            .range([0, 1]);
    }
    return legendOpacityScale;
}
//# sourceMappingURL=color_scale.js.map
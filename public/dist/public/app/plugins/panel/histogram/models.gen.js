//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
import { LegendDisplayMode, TooltipDisplayMode, } from '@grafana/schema';
export var modelVersion = Object.freeze([1, 0]);
export var defaultPanelOptions = {
    bucketOffset: 0,
    legend: {
        displayMode: LegendDisplayMode.List,
        placement: 'bottom',
        calcs: [],
    },
    tooltip: {
        mode: TooltipDisplayMode.Multi,
    },
};
/**
 * @alpha
 */
export var defaultPanelFieldConfig = {
    lineWidth: 1,
    fillOpacity: 80,
    //gradientMode: GraphGradientMode.None,
};
//# sourceMappingURL=models.gen.js.map
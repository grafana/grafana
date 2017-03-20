/// <reference path="../../../../../public/app/headers/common.d.ts" />
import TimeSeries from 'app/core/time_series2';
export declare class DataProcessor {
    private panel;
    constructor(panel: any);
    getSeriesList(options: any): any;
    getAutoDetectXAxisMode(firstItem: any): string;
    setPanelDefaultsForNewXAxisMode(): void;
    timeSeriesHandler(seriesData: any, index: any, options: any): TimeSeries;
    customHandler(dataItem: any): any[];
    validateXAxisSeriesValue(): void;
    getDataFieldNames(dataList: any, onlyNumbers: any): any[];
    getXAxisValueOptions(options: any): {
        text: string;
        value: string;
    }[];
    pluckDeep(obj: any, property: string): any;
}

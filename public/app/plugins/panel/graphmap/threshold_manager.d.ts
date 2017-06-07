/// <reference path="../../../../../public/app/headers/common.d.ts" />
export declare class ThresholdManager {
    private panelCtrl;
    plot: any;
    placeholder: any;
    height: any;
    thresholds: any;
    needsCleanup: boolean;
    hasSecondYAxis: any;
    constructor(panelCtrl: any);
    getHandleHtml(handleIndex: any, model: any, valueStr: any): string;
    initDragging(evt: any): void;
    cleanUp(): void;
    renderHandle(handleIndex: any, defaultHandleTopPos: any): void;
    shouldDrawHandles(): boolean;
    prepare(elem: any, data: any): void;
    draw(plot: any): void;
    addPlotOptions(options: any, panel: any): void;
}

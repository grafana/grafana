/// <reference path="../../../../../public/app/headers/common.d.ts" />
export declare class ThresholdFormCtrl {
    panelCtrl: any;
    panel: any;
    disabled: boolean;
    /** @ngInject */
    constructor($scope: any);
    addThreshold(): void;
    removeThreshold(index: any): void;
    render(): void;
}

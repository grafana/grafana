import { __assign, __read } from "tslib";
import { combineLatest, of } from 'rxjs';
import { ArrayDataFrame } from '@grafana/data';
import { mergeMap } from 'rxjs/operators';
export function mergePanelAndDashData(panelObservable, dashObservable) {
    return combineLatest([panelObservable, dashObservable]).pipe(mergeMap(function (combined) {
        var _a;
        var _b = __read(combined, 2), panelData = _b[0], dashData = _b[1];
        if (Boolean((_a = dashData.annotations) === null || _a === void 0 ? void 0 : _a.length) || Boolean(dashData.alertState)) {
            if (!panelData.annotations) {
                panelData.annotations = [];
            }
            var annotations = panelData.annotations.concat(new ArrayDataFrame(dashData.annotations));
            var alertState = dashData.alertState;
            return of(__assign(__assign({}, panelData), { annotations: annotations, alertState: alertState }));
        }
        return of(panelData);
    }));
}
//# sourceMappingURL=mergePanelAndDashData.js.map
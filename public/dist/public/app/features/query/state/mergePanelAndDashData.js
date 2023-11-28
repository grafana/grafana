import { combineLatest, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { ArrayDataFrame } from '@grafana/data';
export function mergePanelAndDashData(panelObservable, dashObservable) {
    return combineLatest([panelObservable, dashObservable]).pipe(mergeMap((combined) => {
        var _a;
        const [panelData, dashData] = combined;
        if (Boolean((_a = dashData.annotations) === null || _a === void 0 ? void 0 : _a.length) || Boolean(dashData.alertState)) {
            if (!panelData.annotations) {
                panelData.annotations = [];
            }
            const annotations = panelData.annotations.concat(new ArrayDataFrame(dashData.annotations));
            const alertState = dashData.alertState;
            return of(Object.assign(Object.assign({}, panelData), { annotations, alertState }));
        }
        return of(panelData);
    }));
}
//# sourceMappingURL=mergePanelAndDashData.js.map
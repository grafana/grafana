import { of } from 'rxjs';
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
export const mockExplorePanelData = (props) => {
    const data = {
        flameGraphFrames: [],
        graphFrames: [],
        graphResult: [],
        customFrames: [],
        logsFrames: [],
        logsResult: Object.assign({ hasUniqueLabels: false, rows: [], meta: [], series: [], queries: [] }, ((props === null || props === void 0 ? void 0 : props.logsResult) || {})),
        nodeGraphFrames: [],
        rawPrometheusFrames: [],
        rawPrometheusResult: null,
        series: [],
        state: LoadingState.Done,
        tableFrames: [],
        tableResult: [],
        timeRange: getDefaultTimeRange(),
        traceFrames: [],
    };
    return of(data);
};
//# sourceMappingURL=data.js.map
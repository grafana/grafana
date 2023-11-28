import { TimeRangeMock } from './timeRange';
export const RequestMock = {
    range: TimeRangeMock,
    rangeRaw: { from: TimeRangeMock.from, to: TimeRangeMock.to },
    targets: [],
    requestId: '',
    interval: '',
    intervalMs: 0,
    scopedVars: {},
    timezone: '',
    app: '',
    startTime: 0,
};
export const LogsRequestMock = {
    range: TimeRangeMock,
    rangeRaw: { from: TimeRangeMock.from, to: TimeRangeMock.to },
    targets: [],
    requestId: '',
    interval: '',
    intervalMs: 0,
    scopedVars: { __interval: { value: '20s' } },
    timezone: '',
    app: '',
    startTime: 0,
};
//# sourceMappingURL=Request.js.map
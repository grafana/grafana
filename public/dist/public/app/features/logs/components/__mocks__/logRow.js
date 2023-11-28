import { LogLevel, MutableDataFrame } from '@grafana/data';
export const createLogRow = (overrides) => {
    const uid = (overrides === null || overrides === void 0 ? void 0 : overrides.uid) || '1';
    const timeEpochMs = (overrides === null || overrides === void 0 ? void 0 : overrides.timeEpochMs) || 1;
    const entry = (overrides === null || overrides === void 0 ? void 0 : overrides.entry) || `log message ${uid}`;
    return Object.assign({ entryFieldIndex: 0, rowIndex: 0, dataFrame: new MutableDataFrame({ refId: 'A', fields: [] }), uid, logLevel: LogLevel.info, entry, hasAnsi: false, hasUnescapedContent: false, labels: {}, raw: entry, timeFromNow: '', timeEpochMs, timeEpochNs: (timeEpochMs * 1000000).toString(), timeLocal: '', timeUtc: '', searchWords: [] }, overrides);
};
//# sourceMappingURL=logRow.js.map
import { MutableDataFrame, LogLevel, LogsSortOrder } from '@grafana/data';
import { sortLogRows } from 'app/features/logs/utils';
export const makeLogs = (numberOfLogsToCreate, overrides) => {
    const array = [];
    for (let i = 0; i < numberOfLogsToCreate; i++) {
        const uuid = (i + 1).toString();
        const entry = `log message ${uuid}`;
        const timeInMs = (overrides === null || overrides === void 0 ? void 0 : overrides.timeEpochMs) || new Date().getTime();
        array.push(Object.assign({ uid: uuid, entryFieldIndex: 0, rowIndex: 0, dataFrame: new MutableDataFrame(), logLevel: LogLevel.debug, entry, hasAnsi: false, hasUnescapedContent: false, labels: {}, raw: entry, timeFromNow: '', timeEpochMs: timeInMs + i, timeEpochNs: (timeInMs * 1000000 + i).toString(), timeLocal: '', timeUtc: '' }, overrides));
    }
    return sortLogRows(array, LogsSortOrder.Ascending);
};
//# sourceMappingURL=makeLogs.js.map
import { __awaiter } from "tslib";
import memoizeOne from 'memoize-one';
import React, { useCallback, useEffect, useState } from 'react';
import { lastValueFrom } from 'rxjs';
import { applyFieldOverrides, LogsSortOrder, sortDataFrame, transformDataFrame, } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Table } from '@grafana/ui';
import { separateVisibleFields } from 'app/features/logs/components/logParser';
import { parseLogsFrame } from 'app/features/logs/logsFrame';
import { getFieldLinksForExplore } from '../utils/links';
const getTableHeight = memoizeOne((dataFrames) => {
    const largestFrameLength = dataFrames === null || dataFrames === void 0 ? void 0 : dataFrames.reduce((length, frame) => {
        return frame.length > length ? frame.length : length;
    }, 0);
    // from TableContainer.tsx
    return Math.min(600, Math.max(largestFrameLength !== null && largestFrameLength !== void 0 ? largestFrameLength : 0 * 36, 300) + 40 + 46);
});
export const LogsTable = (props) => {
    const { timeZone, splitOpen, range, logsSortOrder, width, logsFrames } = props;
    const [tableFrame, setTableFrame] = useState(undefined);
    const prepareTableFrame = useCallback((frame) => {
        const logsFrame = parseLogsFrame(frame);
        const timeIndex = logsFrame === null || logsFrame === void 0 ? void 0 : logsFrame.timeField.index;
        const sortedFrame = sortDataFrame(frame, timeIndex, logsSortOrder === LogsSortOrder.Descending);
        const [frameWithOverrides] = applyFieldOverrides({
            data: [sortedFrame],
            timeZone,
            theme: config.theme2,
            replaceVariables: (v) => v,
            fieldConfig: {
                defaults: {
                    custom: {},
                },
                overrides: [],
            },
        });
        // `getLinks` and `applyFieldOverrides` are taken from TableContainer.tsx
        for (const field of frameWithOverrides.fields) {
            field.getLinks = (config) => {
                return getFieldLinksForExplore({
                    field,
                    rowIndex: config.valueRowIndex,
                    splitOpenFn: splitOpen,
                    range: range,
                    dataFrame: sortedFrame,
                });
            };
            field.config = Object.assign(Object.assign({}, field.config), { custom: Object.assign({ filterable: true, inspect: true }, field.config.custom) });
        }
        return frameWithOverrides;
    }, [logsSortOrder, range, splitOpen, timeZone]);
    useEffect(() => {
        const prepare = () => __awaiter(void 0, void 0, void 0, function* () {
            if (!logsFrames || !logsFrames.length) {
                setTableFrame(undefined);
                return;
            }
            // TODO: This does not work with multiple logs queries for now, as we currently only support one logs frame.
            let dataFrame = logsFrames[0];
            const logsFrame = parseLogsFrame(dataFrame);
            const timeIndex = logsFrame === null || logsFrame === void 0 ? void 0 : logsFrame.timeField.index;
            dataFrame = sortDataFrame(dataFrame, timeIndex, logsSortOrder === LogsSortOrder.Descending);
            // create extract JSON transformation for every field that is `json.RawMessage`
            // TODO: explore if `logsFrame.ts` can help us with getting the right fields
            const transformations = dataFrame.fields
                .filter((field) => {
                var _a;
                return ((_a = field.typeInfo) === null || _a === void 0 ? void 0 : _a.frame) === 'json.RawMessage';
            })
                .flatMap((field) => {
                return [
                    {
                        id: 'extractFields',
                        options: {
                            format: 'json',
                            keepTime: false,
                            replace: false,
                            source: field.name,
                        },
                    },
                    // hide the field that was extracted
                    {
                        id: 'organize',
                        options: {
                            excludeByName: {
                                [field.name]: true,
                            },
                        },
                    },
                ];
            });
            // remove fields that should not be displayed
            const hiddenFields = separateVisibleFields(dataFrame, { keepBody: true, keepTimestamp: true }).hidden;
            hiddenFields.forEach((field, index) => {
                transformations.push({
                    id: 'organize',
                    options: {
                        excludeByName: {
                            [field.name]: true,
                        },
                    },
                });
            });
            if (transformations.length > 0) {
                const [transformedDataFrame] = yield lastValueFrom(transformDataFrame(transformations, [dataFrame]));
                setTableFrame(prepareTableFrame(transformedDataFrame));
            }
            else {
                setTableFrame(prepareTableFrame(dataFrame));
            }
        });
        prepare();
    }, [prepareTableFrame, logsFrames, logsSortOrder]);
    if (!tableFrame) {
        return null;
    }
    return (React.createElement(Table, { data: tableFrame, width: width, height: getTableHeight(props.logsFrames), footerOptions: { show: true, reducer: ['count'], countRows: true } }));
};
//# sourceMappingURL=LogsTable.js.map
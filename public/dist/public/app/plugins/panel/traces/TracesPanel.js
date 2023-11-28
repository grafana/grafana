import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useMemo, createRef } from 'react';
import { useAsync } from 'react-use';
import { getDataSourceSrv } from '@grafana/runtime';
import { TraceView } from 'app/features/explore/TraceView/TraceView';
import { TopOfViewRefType } from 'app/features/explore/TraceView/components/TraceTimelineViewer/VirtualizedTraceView';
import { transformDataFrames } from 'app/features/explore/TraceView/utils/transform';
const styles = {
    wrapper: css `
    height: 100%;
    overflow: scroll;
  `,
};
export const TracesPanel = ({ data, options }) => {
    const topOfViewRef = createRef();
    const traceProp = useMemo(() => transformDataFrames(data.series[0]), [data.series]);
    const dataSource = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        return yield getDataSourceSrv().get((_b = (_a = data.request) === null || _a === void 0 ? void 0 : _a.targets[0].datasource) === null || _b === void 0 ? void 0 : _b.uid);
    }));
    if (!data || !data.series.length || !traceProp) {
        return (React.createElement("div", { className: "panel-empty" },
            React.createElement("p", null, "No data found in response")));
    }
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { ref: topOfViewRef }),
        React.createElement(TraceView, { dataFrames: data.series, scrollElementClass: styles.wrapper, traceProp: traceProp, queryResponse: data, datasource: dataSource.value, topOfViewRef: topOfViewRef, topOfViewRefType: TopOfViewRefType.Panel, createSpanLink: options.createSpanLink })));
};
//# sourceMappingURL=TracesPanel.js.map
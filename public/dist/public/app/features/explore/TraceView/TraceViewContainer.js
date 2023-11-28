import React, { useMemo } from 'react';
import { PanelChrome } from '@grafana/ui/src/components/PanelChrome/PanelChrome';
import { useSelector } from 'app/types';
import { TraceView } from './TraceView';
import { TopOfViewRefType } from './components/TraceTimelineViewer/VirtualizedTraceView';
import { transformDataFrames } from './utils/transform';
export function TraceViewContainer(props) {
    // At this point we only show single trace
    const frame = props.dataFrames[0];
    const { dataFrames, splitOpenFn, exploreId, scrollElement, topOfViewRef, queryResponse } = props;
    const traceProp = useMemo(() => transformDataFrames(frame), [frame]);
    const datasource = useSelector((state) => { var _a, _b; return (_b = (_a = state.explore.panes[props.exploreId]) === null || _a === void 0 ? void 0 : _a.datasourceInstance) !== null && _b !== void 0 ? _b : undefined; });
    if (!traceProp) {
        return null;
    }
    return (React.createElement(PanelChrome, { padding: "none", title: "Trace" },
        React.createElement(TraceView, { exploreId: exploreId, dataFrames: dataFrames, splitOpenFn: splitOpenFn, scrollElement: scrollElement, traceProp: traceProp, queryResponse: queryResponse, datasource: datasource, topOfViewRef: topOfViewRef, topOfViewRefType: TopOfViewRefType.Explore })));
}
//# sourceMappingURL=TraceViewContainer.js.map
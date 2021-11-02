import React from 'react';
import { Collapse } from '@grafana/ui';
import { TraceView } from './TraceView';
export function TraceViewContainer(props) {
    var dataFrames = props.dataFrames, splitOpenFn = props.splitOpenFn, exploreId = props.exploreId;
    return (React.createElement(Collapse, { label: "Trace View", isOpen: true },
        React.createElement(TraceView, { exploreId: exploreId, dataFrames: dataFrames, splitOpenFn: splitOpenFn })));
}
//# sourceMappingURL=TraceViewContainer.js.map
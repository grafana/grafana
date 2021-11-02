import React from 'react';
import { NodeGraph } from './NodeGraph';
import { useLinks } from '../../../features/explore/utils/links';
export var NodeGraphPanel = function (_a) {
    var width = _a.width, height = _a.height, data = _a.data;
    var getLinks = useLinks(data.timeRange);
    if (!data || !data.series.length) {
        return (React.createElement("div", { className: "panel-empty" },
            React.createElement("p", null, "No data found in response")));
    }
    return (React.createElement("div", { style: { width: width, height: height } },
        React.createElement(NodeGraph, { dataFrames: data.series, getLinks: getLinks })));
};
//# sourceMappingURL=NodeGraphPanel.js.map
import memoizeOne from 'memoize-one';
import React from 'react';
import { useLinks } from '../../../features/explore/utils/links';
import { NodeGraph } from './NodeGraph';
import { getNodeGraphDataFrames } from './utils';
export const NodeGraphPanel = ({ width, height, data, options }) => {
    const getLinks = useLinks(data.timeRange);
    if (!data || !data.series.length) {
        return (React.createElement("div", { className: "panel-empty" },
            React.createElement("p", null, "No data found in response")));
    }
    const memoizedGetNodeGraphDataFrames = memoizeOne(getNodeGraphDataFrames);
    return (React.createElement("div", { style: { width, height } },
        React.createElement(NodeGraph, { dataFrames: memoizedGetNodeGraphDataFrames(data.series, options), getLinks: getLinks })));
};
//# sourceMappingURL=NodeGraphPanel.js.map
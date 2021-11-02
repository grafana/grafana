import React from 'react';
import { SingleModeGraphTooltip } from './SingleModeGraphTooltip';
import { MultiModeGraphTooltip } from './MultiModeGraphTooltip';
export var GraphTooltip = function (_a) {
    var _b = _a.mode, mode = _b === void 0 ? 'single' : _b, dimensions = _a.dimensions, activeDimensions = _a.activeDimensions, pos = _a.pos, timeZone = _a.timeZone;
    // When
    // [1] no active dimension or
    // [2] no xAxis position
    // we assume no tooltip should be rendered
    if (!activeDimensions || !activeDimensions.xAxis) {
        return null;
    }
    if (mode === 'single') {
        return React.createElement(SingleModeGraphTooltip, { dimensions: dimensions, activeDimensions: activeDimensions, timeZone: timeZone });
    }
    else {
        return (React.createElement(MultiModeGraphTooltip, { dimensions: dimensions, activeDimensions: activeDimensions, pos: pos, timeZone: timeZone }));
    }
};
GraphTooltip.displayName = 'GraphTooltip';
//# sourceMappingURL=GraphTooltip.js.map
import React from 'react';
import { MetricSegment } from './MetricSegment';
export function MetricsSection(_a) {
    var _b = _a.segments, segments = _b === void 0 ? [] : _b, state = _a.state;
    return (React.createElement(React.Fragment, null, segments.map(function (segment, index) {
        return React.createElement(MetricSegment, { segment: segment, metricIndex: index, key: index, state: state });
    })));
}
//# sourceMappingURL=MetricsSection.js.map
import React from 'react';
import { MetricSegment } from './MetricSegment';
export function MetricsSection({ segments = [], state }) {
    return (React.createElement(React.Fragment, null, segments.map((segment, index) => {
        return React.createElement(MetricSegment, { segment: segment, metricIndex: index, key: index, state: state });
    })));
}
//# sourceMappingURL=MetricsSection.js.map
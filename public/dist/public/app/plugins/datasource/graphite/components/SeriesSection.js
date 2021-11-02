import React from 'react';
import { TagsSection } from './TagsSection';
import { MetricsSection } from './MetricsSection';
import { SegmentSection } from '@grafana/ui';
export function SeriesSection(_a) {
    var _b, _c;
    var state = _a.state;
    var sectionContent = ((_b = state.queryModel) === null || _b === void 0 ? void 0 : _b.seriesByTagUsed) ? (React.createElement(TagsSection, { tags: (_c = state.queryModel) === null || _c === void 0 ? void 0 : _c.tags, state: state })) : (React.createElement(MetricsSection, { segments: state.segments, state: state }));
    return (React.createElement(SegmentSection, { label: "Series", fill: true }, sectionContent));
}
//# sourceMappingURL=SeriesSection.js.map
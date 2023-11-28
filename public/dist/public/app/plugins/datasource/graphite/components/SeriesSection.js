import React from 'react';
import { SegmentSection } from '@grafana/ui';
import { MetricsSection } from './MetricsSection';
import { TagsSection } from './TagsSection';
export function SeriesSection({ state }) {
    var _a, _b;
    const sectionContent = ((_a = state.queryModel) === null || _a === void 0 ? void 0 : _a.seriesByTagUsed) ? (React.createElement(TagsSection, { tags: (_b = state.queryModel) === null || _b === void 0 ? void 0 : _b.tags, state: state })) : (React.createElement(MetricsSection, { segments: state.segments, state: state }));
    return (React.createElement(SegmentSection, { label: "Series", fill: true }, sectionContent));
}
//# sourceMappingURL=SeriesSection.js.map
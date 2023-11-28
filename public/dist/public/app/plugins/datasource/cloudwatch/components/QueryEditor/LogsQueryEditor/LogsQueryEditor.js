import { css } from '@emotion/css';
import React, { memo } from 'react';
import { config } from '@grafana/runtime';
import { InlineFormLabel } from '@grafana/ui';
import { CloudWatchLink } from './CloudWatchLink';
import CloudWatchLogsQueryFieldMonaco from './LogsQueryField';
import CloudWatchLogsQueryField from './LogsQueryFieldOld';
const labelClass = css `
  margin-left: 3px;
  flex-grow: 0;
`;
export const CloudWatchLogsQueryEditor = memo(function CloudWatchLogsQueryEditor(props) {
    var _a, _b;
    const { query, data, datasource, exploreId } = props;
    let absolute;
    if ((_b = (_a = data === null || data === void 0 ? void 0 : data.request) === null || _a === void 0 ? void 0 : _a.range) === null || _b === void 0 ? void 0 : _b.from) {
        const { range } = data.request;
        absolute = {
            from: range.from.valueOf(),
            to: range.to.valueOf(),
        };
    }
    else {
        absolute = {
            from: Date.now() - 10000,
            to: Date.now(),
        };
    }
    return config.featureToggles.cloudWatchLogsMonacoEditor ? (React.createElement(CloudWatchLogsQueryFieldMonaco, Object.assign({}, props, { ExtraFieldElement: React.createElement(InlineFormLabel, { className: `gf-form-label--btn ${labelClass}`, width: "auto", tooltip: "Link to Graph in AWS" },
            React.createElement(CloudWatchLink, { query: query, panelData: data, datasource: datasource })) }))) : (React.createElement(CloudWatchLogsQueryField, Object.assign({}, props, { exploreId: exploreId, history: [], absoluteRange: absolute, ExtraFieldElement: React.createElement(InlineFormLabel, { className: `gf-form-label--btn ${labelClass}`, width: "auto", tooltip: "Link to Graph in AWS" },
            React.createElement(CloudWatchLink, { query: query, panelData: data, datasource: datasource })) })));
});
export default CloudWatchLogsQueryEditor;
//# sourceMappingURL=LogsQueryEditor.js.map
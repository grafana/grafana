// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { css } from '@emotion/css';
import cx from 'classnames';
import React, { memo, useEffect, useMemo } from 'react';
import { dateTimeFormat } from '@grafana/data';
import { Badge, Tooltip, useStyles2 } from '@grafana/ui';
import ExternalLinks from '../common/ExternalLinks';
import TraceName from '../common/TraceName';
import { getTraceLinks } from '../model/link-patterns';
import { getHeaderTags, getTraceName } from '../model/trace-viewer';
import { formatDuration } from '../utils/date';
import TracePageActions from './Actions/TracePageActions';
import { SpanFilters } from './SpanFilters/SpanFilters';
export const TracePageHeader = memo((props) => {
    const { trace, data, app, timeZone, search, setSearch, showSpanFilters, setShowSpanFilters, showSpanFilterMatchesOnly, setShowSpanFilterMatchesOnly, setFocusedSpanIdForSearch, spanFilterMatches, datasourceType, setHeaderHeight, } = props;
    const styles = useStyles2(getNewStyles);
    useEffect(() => {
        var _a, _b;
        setHeaderHeight((_b = (_a = document.querySelector('.' + styles.header)) === null || _a === void 0 ? void 0 : _a.scrollHeight) !== null && _b !== void 0 ? _b : 0);
    }, [setHeaderHeight, showSpanFilters, styles.header]);
    const links = useMemo(() => {
        if (!trace) {
            return [];
        }
        return getTraceLinks(trace);
    }, [trace]);
    if (!trace) {
        return null;
    }
    const timestamp = (trace, timeZone) => {
        // Convert date from micro to milli seconds
        const dateStr = dateTimeFormat(trace.startTime / 1000, { timeZone, defaultWithMS: true });
        const match = dateStr.match(/^(.+)(:\d\d\.\d+)$/);
        return match ? (React.createElement("span", { className: styles.TracePageHeaderOverviewItemValue },
            match[1],
            React.createElement("span", { className: styles.TracePageHeaderOverviewItemValueDetail }, match[2]))) : (dateStr);
    };
    const title = (React.createElement("h1", { className: cx(styles.title) },
        React.createElement(TraceName, { traceName: getTraceName(trace.spans) }),
        React.createElement("small", { className: styles.duration }, formatDuration(trace.duration))));
    const { method, status, url } = getHeaderTags(trace.spans);
    let statusColor = 'green';
    if (status && status.length > 0) {
        if (status[0].value.toString().charAt(0) === '4') {
            statusColor = 'orange';
        }
        else if (status[0].value.toString().charAt(0) === '5') {
            statusColor = 'red';
        }
    }
    return (React.createElement("header", { className: styles.header },
        React.createElement("div", { className: styles.titleRow },
            links && links.length > 0 && React.createElement(ExternalLinks, { links: links, className: styles.TracePageHeaderBack }),
            title,
            React.createElement(TracePageActions, { traceId: trace.traceID, data: data, app: app })),
        React.createElement("div", { className: styles.subtitle },
            React.createElement("span", { className: styles.timestamp }, timestamp(trace, timeZone)),
            React.createElement("span", { className: styles.tagMeta },
                method && method.length > 0 && (React.createElement(Tooltip, { content: 'http.method', interactive: true },
                    React.createElement("span", { className: styles.tag },
                        React.createElement(Badge, { text: method[0].value, color: "blue" })))),
                status && status.length > 0 && (React.createElement(Tooltip, { content: 'http.status_code', interactive: true },
                    React.createElement("span", { className: styles.tag },
                        React.createElement(Badge, { text: status[0].value, color: statusColor })))),
                url && url.length > 0 && (React.createElement(Tooltip, { content: 'http.url or http.target or http.path', interactive: true },
                    React.createElement("span", { className: styles.url }, url[0].value))))),
        React.createElement(SpanFilters, { trace: trace, showSpanFilters: showSpanFilters, setShowSpanFilters: setShowSpanFilters, showSpanFilterMatchesOnly: showSpanFilterMatchesOnly, setShowSpanFilterMatchesOnly: setShowSpanFilterMatchesOnly, search: search, setSearch: setSearch, spanFilterMatches: spanFilterMatches, setFocusedSpanIdForSearch: setFocusedSpanIdForSearch, datasourceType: datasourceType })));
});
TracePageHeader.displayName = 'TracePageHeader';
const getNewStyles = (theme) => {
    return {
        TracePageHeaderBack: css `
      label: TracePageHeaderBack;
      align-items: center;
      align-self: stretch;
      background-color: #fafafa;
      border-bottom: 1px solid #ddd;
      border-right: 1px solid #ddd;
      color: inherit;
      display: flex;
      font-size: 1.4rem;
      padding: 0 1rem;
      margin-bottom: -1px;
      &:hover {
        background-color: #f0f0f0;
        border-color: #ccc;
      }
    `,
        TracePageHeaderOverviewItemValueDetail: cx(css `
        label: TracePageHeaderOverviewItemValueDetail;
        color: #aaa;
      `, 'trace-item-value-detail'),
        TracePageHeaderOverviewItemValue: css `
      label: TracePageHeaderOverviewItemValue;
      &:hover > .trace-item-value-detail {
        color: unset;
      }
    `,
        header: css `
      label: TracePageHeader;
      background-color: ${theme.colors.background.primary};
      padding: 0.5em 0 0 0;
      position: sticky;
      top: 0;
      z-index: 5;
    `,
        titleRow: css `
      align-items: flex-start;
      display: flex;
      padding: 0 8px;
    `,
        title: css `
      color: inherit;
      flex: 1;
      font-size: 1.7em;
      line-height: 1em;
    `,
        subtitle: css `
      flex: 1;
      line-height: 1em;
      margin: -0.5em 0.5em 0.75em 0.5em;
    `,
        tag: css `
      margin: 0 0.5em 0 0;
    `,
        duration: css `
      color: #aaa;
      margin: 0 0.75em;
    `,
        timestamp: css `
      vertical-align: middle;
    `,
        tagMeta: css `
      margin: 0 0.75em;
      vertical-align: text-top;
    `,
        url: css `
      margin: -2.5px 0.3em;
      height: 15px;
      overflow: hidden;
      word-break: break-all;
      line-height: 20px;
    `,
        TracePageHeaderTraceId: css `
      label: TracePageHeaderTraceId;
      white-space: nowrap;
      text-overflow: ellipsis;
      max-width: 30%;
      display: inline-block;
    `,
    };
};
//# sourceMappingURL=TracePageHeader.js.map
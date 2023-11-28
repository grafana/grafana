// Copyright (c) 2018 Uber Technologies, Inc.
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
import { css, cx } from '@emotion/css';
import { get, maxBy, values } from 'lodash';
import React, { memo, useEffect, useCallback } from 'react';
import { config, reportInteraction } from '@grafana/runtime';
import { Icon, Tooltip, useTheme2 } from '@grafana/ui';
import { getButtonStyles } from '@grafana/ui/src/components/Button';
export default memo(function NextPrevResult(props) {
    var _a;
    const { trace, spanFilterMatches, setFocusedSpanIdForSearch, focusedSpanIndexForSearch, setFocusedSpanIndexForSearch, datasourceType, showSpanFilters, } = props;
    const styles = getStyles(useTheme2(), showSpanFilters);
    useEffect(() => {
        if (spanFilterMatches && focusedSpanIndexForSearch !== -1) {
            const spanMatches = Array.from(spanFilterMatches);
            setFocusedSpanIdForSearch(spanMatches[focusedSpanIndexForSearch]);
        }
    }, [focusedSpanIndexForSearch, setFocusedSpanIdForSearch, spanFilterMatches]);
    const nextResult = (event, buttonEnabled) => {
        event.preventDefault();
        event.stopPropagation();
        if (buttonEnabled) {
            reportInteraction('grafana_traces_trace_view_find_next_prev_clicked', {
                datasourceType: datasourceType,
                grafana_version: config.buildInfo.version,
                direction: 'next',
            });
            // new query || at end, go to start
            if (focusedSpanIndexForSearch === -1 ||
                (spanFilterMatches && focusedSpanIndexForSearch === spanFilterMatches.size - 1)) {
                setFocusedSpanIndexForSearch(0);
                return;
            }
            // get next
            setFocusedSpanIndexForSearch(focusedSpanIndexForSearch + 1);
        }
    };
    const prevResult = (event, buttonEnabled) => {
        event.preventDefault();
        event.stopPropagation();
        if (buttonEnabled) {
            reportInteraction('grafana_traces_trace_view_find_next_prev_clicked', {
                datasourceType: datasourceType,
                grafana_version: config.buildInfo.version,
                direction: 'prev',
            });
            // new query || at start, go to end
            if (spanFilterMatches && (focusedSpanIndexForSearch === -1 || focusedSpanIndexForSearch === 0)) {
                setFocusedSpanIndexForSearch(spanFilterMatches.size - 1);
                return;
            }
            // get prev
            setFocusedSpanIndexForSearch(focusedSpanIndexForSearch - 1);
        }
    };
    const nextResultOnKeyDown = (event, buttonEnabled) => {
        if (event.key === 'Enter') {
            nextResult(event, buttonEnabled);
        }
    };
    const prevResultOnKeyDown = (event, buttonEnabled) => {
        if (event.key === 'Enter') {
            prevResult(event, buttonEnabled);
        }
    };
    const buttonEnabled = (_a = (spanFilterMatches && (spanFilterMatches === null || spanFilterMatches === void 0 ? void 0 : spanFilterMatches.size) > 0)) !== null && _a !== void 0 ? _a : false;
    const buttonClass = buttonEnabled ? styles.button : cx(styles.button, styles.buttonDisabled);
    const getTooltip = useCallback((content) => {
        return (React.createElement(Tooltip, { content: content, placement: "top" },
            React.createElement("span", { className: styles.tooltip },
                React.createElement(Icon, { name: "info-circle", size: "md" }))));
    }, [styles.tooltip]);
    const getMatchesMetadata = useCallback((depth, services) => {
        const matchedServices = [];
        const matchedDepth = [];
        let metadata = (React.createElement(React.Fragment, null,
            React.createElement("span", null, `${trace.spans.length} spans`),
            getTooltip(React.createElement(React.Fragment, null,
                React.createElement("div", null,
                    "Services: ",
                    services),
                React.createElement("div", null,
                    "Depth: ",
                    depth)))));
        if (spanFilterMatches) {
            spanFilterMatches.forEach((spanID) => {
                var _a;
                if (trace.processes[spanID]) {
                    matchedServices.push(trace.processes[spanID].serviceName);
                    matchedDepth.push(((_a = trace.spans.find((span) => span.spanID === spanID)) === null || _a === void 0 ? void 0 : _a.depth) || 0);
                }
            });
            if (spanFilterMatches.size === 0) {
                metadata = (React.createElement(React.Fragment, null,
                    React.createElement("span", null, "0 matches"),
                    getTooltip('There are 0 span matches for the filters selected. Please try removing some of the selected filters.')));
            }
            else {
                const type = spanFilterMatches.size === 1 ? 'match' : 'matches';
                const text = focusedSpanIndexForSearch !== -1
                    ? `${focusedSpanIndexForSearch + 1}/${spanFilterMatches.size} ${type}`
                    : `${spanFilterMatches.size} ${type}`;
                metadata = (React.createElement(React.Fragment, null,
                    React.createElement("span", null, text),
                    getTooltip(React.createElement(React.Fragment, null,
                        React.createElement("div", null,
                            "Services: ",
                            new Set(matchedServices).size,
                            "/",
                            services),
                        React.createElement("div", null,
                            "Depth: ",
                            new Set(matchedDepth).size,
                            "/",
                            depth)))));
            }
        }
        return metadata;
    }, [focusedSpanIndexForSearch, getTooltip, spanFilterMatches, trace.processes, trace.spans]);
    const services = new Set(values(trace.processes).map((p) => p.serviceName)).size;
    const depth = get(maxBy(trace.spans, 'depth'), 'depth', 0) + 1;
    return (React.createElement(React.Fragment, null,
        React.createElement("span", { className: styles.matches }, getMatchesMetadata(depth, services)),
        React.createElement("div", { className: buttonEnabled ? styles.buttons : cx(styles.buttons, styles.buttonsDisabled) },
            React.createElement("div", { "aria-label": "Prev result button", className: buttonClass, onClick: (event) => prevResult(event, buttonEnabled), onKeyDown: (event) => prevResultOnKeyDown(event, buttonEnabled), role: "button", tabIndex: buttonEnabled ? 0 : -1 }, "Prev"),
            React.createElement("div", { "aria-label": "Next result button", className: buttonClass, onClick: (event) => nextResult(event, buttonEnabled), onKeyDown: (event) => nextResultOnKeyDown(event, buttonEnabled), role: "button", tabIndex: buttonEnabled ? 0 : -1 }, "Next"))));
});
export const getStyles = (theme, showSpanFilters) => {
    const buttonStyles = getButtonStyles({
        theme,
        variant: 'secondary',
        size: showSpanFilters ? 'md' : 'sm',
        iconOnly: false,
        fill: 'outline',
    });
    return {
        buttons: css `
      display: inline-flex;
      gap: 4px;
    `,
        buttonsDisabled: css `
      cursor: not-allowed;
    `,
        button: css `
      ${buttonStyles.button};
    `,
        buttonDisabled: css `
      ${buttonStyles.disabled};
      pointer-events: none;
    `,
        matches: css `
      margin-right: ${theme.spacing(2)};
    `,
        tooltip: css `
      color: #aaa;
      margin: 0 0 0 5px;
    `,
    };
};
//# sourceMappingURL=NextPrevResult.js.map
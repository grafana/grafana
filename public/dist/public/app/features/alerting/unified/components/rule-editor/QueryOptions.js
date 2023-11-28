import { css } from '@emotion/css';
import React, { useState } from 'react';
import { dateTime, getDefaultRelativeTimeRange } from '@grafana/data';
import { relativeToTimeRange } from '@grafana/data/src/datetime/rangeutil';
import { clearButtonStyles, Icon, InlineField, RelativeTimeRangePicker, Toggletip, useStyles2 } from '@grafana/ui';
import { MaxDataPointsOption, MinIntervalOption } from './QueryWrapper';
export const QueryOptions = ({ query, queryOptions, onChangeTimeRange, onChangeQueryOptions, index, }) => {
    var _a;
    const styles = useStyles2(getStyles);
    const [showOptions, setShowOptions] = useState(false);
    const timeRange = query.relativeTimeRange ? relativeToTimeRange(query.relativeTimeRange) : undefined;
    return (React.createElement(React.Fragment, null,
        React.createElement(Toggletip, { content: React.createElement("div", { className: styles.queryOptions },
                onChangeTimeRange && (React.createElement(InlineField, { label: "Time Range" },
                    React.createElement(RelativeTimeRangePicker, { timeRange: (_a = query.relativeTimeRange) !== null && _a !== void 0 ? _a : getDefaultRelativeTimeRange(), onChange: (range) => onChangeTimeRange(range, index) }))),
                React.createElement(MaxDataPointsOption, { options: queryOptions, onChange: (options) => onChangeQueryOptions(options, index) }),
                React.createElement(MinIntervalOption, { options: queryOptions, onChange: (options) => onChangeQueryOptions(options, index) })), closeButton: true, placement: "bottom-start" },
            React.createElement("button", { type: "button", className: styles.actionLink, onClick: () => setShowOptions(!showOptions) },
                "Options ",
                showOptions ? React.createElement(Icon, { name: "angle-right" }) : React.createElement(Icon, { name: "angle-down" }))),
        React.createElement("div", { className: styles.staticValues },
            React.createElement("span", null, dateTime(timeRange === null || timeRange === void 0 ? void 0 : timeRange.from)
                .locale('en')
                .fromNow(true)),
            queryOptions.maxDataPoints && React.createElement("span", null,
                ", MD = ",
                queryOptions.maxDataPoints),
            queryOptions.minInterval && React.createElement("span", null,
                ", Min. Interval = ",
                queryOptions.minInterval))));
};
const getStyles = (theme) => {
    const clearButton = clearButtonStyles(theme);
    return {
        queryOptions: css `
      > div {
        justify-content: space-between;
      }
    `,
        staticValues: css `
      color: ${theme.colors.text.secondary};
      margin-right: ${theme.spacing(1)};
    `,
        actionLink: css `
      ${clearButton};
      color: ${theme.colors.text.link};
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    `,
    };
};
//# sourceMappingURL=QueryOptions.js.map
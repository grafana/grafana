import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export function CheatSheet() {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", null,
        React.createElement("h2", null, "MySQL cheat sheet"),
        "Time series:",
        React.createElement("ul", { className: styles.ulPadding },
            React.createElement("li", null, "return column named time or time_sec (in UTC), as a unix time stamp or any sql native date data type. You can use the macros below."),
            React.createElement("li", null, "return column(s) with numeric datatype as values")),
        "Optional:",
        React.createElement("ul", { className: styles.ulPadding },
            React.createElement("li", null,
                "return column named ",
                React.createElement("i", null, "metric"),
                " to represent the series name."),
            React.createElement("li", null, "If multiple value columns are returned the metric column is used as prefix."),
            React.createElement("li", null, "If no column named metric is found the column name of the value column is used as series name")),
        React.createElement("p", null, "Resultsets of time series queries need to be sorted by time."),
        "Table:",
        React.createElement("ul", { className: styles.ulPadding },
            React.createElement("li", null, "return any set of columns")),
        "Macros:",
        React.createElement("ul", { className: styles.ulPadding },
            React.createElement("li", null, "$__time(column) -> UNIX_TIMESTAMP(column) as time_sec"),
            React.createElement("li", null, "$__timeEpoch(column) -> UNIX_TIMESTAMP(column) as time_sec"),
            React.createElement("li", null, "$__timeFilter(column) -> column BETWEEN FROM_UNIXTIME(1492750877) AND FROM_UNIXTIME(1492750877)"),
            React.createElement("li", null, "$__unixEpochFilter(column) -> time_unix_epoch > 1492750877 AND time_unix_epoch < 1492750877"),
            React.createElement("li", null, "$__unixEpochNanoFilter(column) -> column >= 1494410783152415214 AND column <= 1494497183142514872"),
            React.createElement("li", null, "$__timeGroup(column,'5m'[, fillvalue]) -> cast(cast(UNIX_TIMESTAMP(column)/(300) as signed)*300 as signed) by setting fillvalue grafana will fill in missing values according to the interval fillvalue can be either a literal value, NULL or previous; previous will fill in the previous seen value or NULL if none has been seen yet"),
            React.createElement("li", null, "$__timeGroupAlias(column,'5m') -> cast(cast(UNIX_TIMESTAMP(column)/(300) as signed)*300 as signed) AS \"time\""),
            React.createElement("li", null, "$__unixEpochGroup(column,'5m') -> column DIV 300 * 300"),
            React.createElement("li", null, "$__unixEpochGroupAlias(column,'5m') -> column DIV 300 * 300 AS \"time\"")),
        React.createElement("p", null, "Example of group by and order by with $__timeGroup:"),
        React.createElement("pre", null,
            React.createElement("code", null,
                "$__timeGroupAlias(timestamp_col, '1h'), sum(value_double) as value",
                React.createElement("br", null),
                "FROM yourtable",
                React.createElement("br", null),
                "GROUP BY 1",
                React.createElement("br", null),
                "ORDER BY 1",
                React.createElement("br", null))),
        "Or build your own conditionals using these macros which just return the values:",
        React.createElement("ul", { className: styles.ulPadding },
            React.createElement("li", null, "$__timeFrom() -> FROM_UNIXTIME(1492750877)"),
            React.createElement("li", null, "$__timeTo() -> FROM_UNIXTIME(1492750877)"),
            React.createElement("li", null, "$__unixEpochFrom() -> 1492750877"),
            React.createElement("li", null, "$__unixEpochTo() -> 1492750877"),
            React.createElement("li", null, "$__unixEpochNanoFrom() -> 1494410783152415214"),
            React.createElement("li", null, "$__unixEpochNanoTo() -> 1494497183142514872"))));
}
function getStyles(theme) {
    return {
        ulPadding: css({
            margin: theme.spacing(1, 0),
            paddingLeft: theme.spacing(5),
        }),
    };
}
//# sourceMappingURL=CheatSheet.js.map
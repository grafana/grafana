import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui/';
const getStyles = (theme) => {
    // Borrowed from the monaco styles
    const reddish = theme.isDark ? '#ce9178' : '#a31515';
    const greenish = theme.isDark ? '#73bf69' : '#56a64b';
    return {
        metricName: css `
      color: ${greenish};
    `,
        metricValue: css `
      color: ${reddish};
    `,
        expanded: css `
      display: block;
      text-indent: 1em;
    `,
    };
};
const RawListItemAttributes = ({ value, index, length, isExpandedView, }) => {
    const styles = useStyles2(getStyles);
    // From the beginning of the string to the start of the `=`
    const attributeName = value.key;
    // From after the `="` to before the last `"`
    const attributeValue = value.value;
    return (React.createElement("span", { className: isExpandedView ? styles.expanded : '', key: index },
        React.createElement("span", { className: styles.metricName }, attributeName),
        React.createElement("span", null, "="),
        React.createElement("span", null, "\""),
        React.createElement("span", { className: styles.metricValue }, attributeValue),
        React.createElement("span", null, "\""),
        index < length - 1 && React.createElement("span", null, ", ")));
};
export default RawListItemAttributes;
//# sourceMappingURL=RawListItemAttributes.js.map
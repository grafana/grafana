import { css } from '@emotion/css';
import { take, takeRight, uniqueId } from 'lodash';
import React from 'react';
import { Stack } from '@grafana/experimental';
import { getTagColorsFromName, useStyles2 } from '@grafana/ui';
import { HoverCard } from '../HoverCard';
// renders the first N number of matchers
const Matchers = ({ matchers }) => {
    const styles = useStyles2(getStyles);
    const NUM_MATCHERS = 5;
    const firstFew = take(matchers, NUM_MATCHERS);
    const rest = takeRight(matchers, matchers.length - NUM_MATCHERS);
    const hasMoreMatchers = rest.length > 0;
    return (React.createElement("span", { "data-testid": "label-matchers" },
        React.createElement(Stack, { direction: "row", gap: 1, alignItems: "center" },
            firstFew.map((matcher) => (React.createElement(MatcherBadge, { key: uniqueId(), matcher: matcher }))),
            hasMoreMatchers && (React.createElement(HoverCard, { arrow: true, placement: "top", content: React.createElement(React.Fragment, null, rest.map((matcher) => (React.createElement(MatcherBadge, { key: uniqueId(), matcher: matcher })))) },
                React.createElement("span", null,
                    React.createElement("div", { className: styles.metadata }, `and ${rest.length} more`)))))));
};
const MatcherBadge = ({ matcher: [label, operator, value] }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.matcher(label).wrapper },
        React.createElement(Stack, { direction: "row", gap: 0, alignItems: "baseline" },
            label,
            " ",
            operator,
            " ",
            value)));
};
const getStyles = (theme) => ({
    matcher: (label) => {
        const { color, borderColor } = getTagColorsFromName(label);
        return {
            wrapper: css `
        color: #fff;
        background: ${color};
        padding: ${theme.spacing(0.33)} ${theme.spacing(0.66)};
        font-size: ${theme.typography.bodySmall.fontSize};

        border: solid 1px ${borderColor};
        border-radius: ${theme.shape.borderRadius(2)};
      `,
        };
    },
    metadata: css `
    color: ${theme.colors.text.secondary};

    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.bodySmall.fontWeight};
  `,
});
export { Matchers };
//# sourceMappingURL=Matchers.js.map
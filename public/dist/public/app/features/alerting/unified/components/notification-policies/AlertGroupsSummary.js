import pluralize from 'pluralize';
import React, { Fragment } from 'react';
import { Stack } from '@grafana/experimental';
import { Badge } from '@grafana/ui';
export const AlertGroupsSummary = ({ active = 0, suppressed = 0, unprocessed = 0 }) => {
    const statsComponents = [];
    const total = active + suppressed + unprocessed;
    if (active) {
        statsComponents.push(React.createElement(Badge, { color: "red", key: "firing", text: `${active} firing` }));
    }
    if (suppressed) {
        statsComponents.push(React.createElement(Badge, { color: "blue", key: "suppressed", text: `${suppressed} suppressed` }));
    }
    if (unprocessed) {
        statsComponents.push(React.createElement(Badge, { color: "orange", key: "unprocessed", text: `${unprocessed} unprocessed` }));
    }
    // if we only have one category it's not really necessary to repeat the total
    if (statsComponents.length > 1) {
        statsComponents.unshift(React.createElement(Fragment, { key: "total" },
            total,
            " ",
            pluralize('instance', total)));
    }
    const hasStats = Boolean(statsComponents.length);
    return hasStats ? React.createElement(Stack, { gap: 0.5 }, statsComponents) : null;
};
//# sourceMappingURL=AlertGroupsSummary.js.map
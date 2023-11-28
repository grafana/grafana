import { uniq } from 'lodash';
import React from 'react';
import { Icon, Label, MultiSelect } from '@grafana/ui';
export const GroupBy = ({ className, groups, groupBy, onGroupingChange }) => {
    const labelKeyOptions = uniq(groups.flatMap((group) => group.alerts).flatMap(({ labels }) => Object.keys(labels)))
        .filter((label) => !(label.startsWith('__') && label.endsWith('__'))) // Filter out private labels
        .map((key) => ({
        label: key,
        value: key,
    }));
    return (React.createElement("div", { "data-testid": 'group-by-container', className: className },
        React.createElement(Label, null, "Custom group by"),
        React.createElement(MultiSelect, { "aria-label": 'group by label keys', value: groupBy, placeholder: "Group by", prefix: React.createElement(Icon, { name: 'tag-alt' }), onChange: (items) => {
                onGroupingChange(items.map(({ value }) => value));
            }, options: labelKeyOptions })));
};
//# sourceMappingURL=GroupBy.js.map
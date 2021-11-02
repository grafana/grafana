import React from 'react';
import { uniq } from 'lodash';
import { Icon, Label, MultiSelect } from '@grafana/ui';
export var GroupBy = function (_a) {
    var className = _a.className, groups = _a.groups, groupBy = _a.groupBy, onGroupingChange = _a.onGroupingChange;
    var labelKeyOptions = uniq(groups.flatMap(function (group) { return group.alerts; }).flatMap(function (_a) {
        var labels = _a.labels;
        return Object.keys(labels);
    }))
        .filter(function (label) { return !(label.startsWith('__') && label.endsWith('__')); }) // Filter out private labels
        .map(function (key) { return ({
        label: key,
        value: key,
    }); });
    return (React.createElement("div", { "data-testid": 'group-by-container', className: className },
        React.createElement(Label, null, "Custom group by"),
        React.createElement(MultiSelect, { "aria-label": 'group by label keys', value: groupBy, placeholder: "Group by", prefix: React.createElement(Icon, { name: 'tag-alt' }), onChange: function (items) {
                onGroupingChange(items.map(function (_a) {
                    var value = _a.value;
                    return value;
                }));
            }, options: labelKeyOptions })));
};
//# sourceMappingURL=GroupBy.js.map
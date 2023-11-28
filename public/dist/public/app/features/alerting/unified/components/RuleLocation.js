import React from 'react';
import { Icon } from '@grafana/ui';
const RuleLocation = ({ namespace, group }) => {
    if (!group) {
        return React.createElement(React.Fragment, null, namespace);
    }
    return (React.createElement(React.Fragment, null,
        namespace,
        " ",
        React.createElement(Icon, { name: "angle-right" }),
        " ",
        group));
};
export { RuleLocation };
//# sourceMappingURL=RuleLocation.js.map
import React from 'react';
import { DetailsField } from '../DetailsField';
const RuleDetailsFederatedSources = ({ group }) => {
    var _a;
    const sourceTenants = (_a = group.source_tenants) !== null && _a !== void 0 ? _a : [];
    return (React.createElement(DetailsField, { label: "Tenant sources" },
        React.createElement(React.Fragment, null, sourceTenants.map((tenant) => (React.createElement("div", { key: tenant }, tenant))))));
};
export { RuleDetailsFederatedSources };
//# sourceMappingURL=RuleDetailsFederatedSources.js.map
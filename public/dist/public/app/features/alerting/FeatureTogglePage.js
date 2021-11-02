import React from 'react';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
export default function FeatureTogglePage() {
    var navModel = useNavModel('alert-list');
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement("h1", null, "Alerting is not enabled"),
            "To enable alerting, enable it in the Grafana config:",
            React.createElement("div", null,
                React.createElement("pre", null, "[unified_alerting]\nenable = true\n")),
            React.createElement("div", null,
                "For legacy alerting",
                React.createElement("pre", null, "[alerting]\nenable = true\n")))));
}
//# sourceMappingURL=FeatureTogglePage.js.map
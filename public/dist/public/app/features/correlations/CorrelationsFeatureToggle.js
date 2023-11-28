import React from 'react';
import { Page } from 'app/core/components/Page/Page';
import { Trans } from 'app/core/internationalization';
export default function FeatureTogglePage() {
    return (React.createElement(Page, { navId: "correlations" },
        React.createElement(Page.Contents, null,
            React.createElement("h1", null,
                React.createElement(Trans, { i18nKey: "correlations.page-heading" }, "Correlations are disabled")),
            React.createElement(Trans, { i18nKey: "correlations.page-content" }, "To enable Correlations, add it in the Grafana config:"),
            React.createElement("div", null,
                React.createElement("pre", null, `[feature_toggles]
correlations = true
`)))));
}
//# sourceMappingURL=CorrelationsFeatureToggle.js.map
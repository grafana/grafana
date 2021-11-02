import React from 'react';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
export default function FeatureTogglePage() {
    var navModel = useNavModel('live-status');
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement("h1", null, "Pipeline is not enabled"),
            "To enable pipelines, enable the feature toggle:",
            React.createElement("pre", null, "[feature_toggles] \nenable = live-pipeline\n"))));
}
//# sourceMappingURL=FeatureTogglePage.js.map
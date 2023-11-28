import React from 'react';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
export default function FeatureTogglePage() {
    const navModel = useNavModel('profile-settings');
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement("h1", null, "Profile is not enabled."),
            "Enable profile in the Grafana config file.",
            React.createElement("div", null,
                React.createElement("pre", null, `[profile]
enable = true
`)))));
}
//# sourceMappingURL=FeatureTogglePage.js.map
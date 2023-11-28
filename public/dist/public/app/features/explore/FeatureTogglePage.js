import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
export default function FeatureTogglePage() {
    const styles = useStyles2((theme) => css `
      margin-top: ${theme.spacing(2)};
    `);
    return (React.createElement(Page, { className: styles },
        React.createElement(Page.Contents, null,
            React.createElement("h1", null, "Explore is disabled"),
            "To enable Explore, enable it in the Grafana config:",
            React.createElement("div", null,
                React.createElement("pre", null, `[explore]
enable = true
`)))));
}
//# sourceMappingURL=FeatureTogglePage.js.map
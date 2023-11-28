// Libraries
import React, { PureComponent } from 'react';
import { LinkButton } from '@grafana/ui';
export class TestInfoTab extends PureComponent {
    constructor(props) {
        super(props);
    }
    render() {
        return (React.createElement("div", null,
            "See github for more information about setting up a reproducible test environment.",
            React.createElement("br", null),
            React.createElement("br", null),
            React.createElement(LinkButton, { variant: "secondary", href: "https://github.com/grafana/grafana/tree/main/devenv", target: "_blank", rel: "noopener noreferrer" }, "GitHub"),
            React.createElement("br", null)));
    }
}
//# sourceMappingURL=TestInfoTab.js.map
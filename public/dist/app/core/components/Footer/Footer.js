import React from 'react';
import { Tooltip } from '@grafana/ui';
export var Footer = React.memo(function (_a) {
    var appName = _a.appName, buildVersion = _a.buildVersion, buildCommit = _a.buildCommit, newGrafanaVersionExists = _a.newGrafanaVersionExists, newGrafanaVersion = _a.newGrafanaVersion;
    return (React.createElement("footer", { className: "footer" },
        React.createElement("div", { className: "text-center" },
            React.createElement("ul", null,
                React.createElement("li", null,
                    React.createElement("a", { href: "http://docs.grafana.org", target: "_blank" },
                        React.createElement("i", { className: "fa fa-file-code-o" }),
                        " Docs")),
                React.createElement("li", null,
                    React.createElement("a", { href: "https://grafana.com/services/support", target: "_blank" },
                        React.createElement("i", { className: "fa fa-support" }),
                        " Support Plans")),
                React.createElement("li", null,
                    React.createElement("a", { href: "https://community.grafana.com/", target: "_blank" },
                        React.createElement("i", { className: "fa fa-comments-o" }),
                        " Community")),
                React.createElement("li", null,
                    React.createElement("a", { href: "https://grafana.com", target: "_blank" }, appName),
                    ' ',
                    React.createElement("span", null,
                        "v",
                        buildVersion,
                        " (commit: ",
                        buildCommit,
                        ")")),
                newGrafanaVersionExists && (React.createElement("li", null,
                    React.createElement(Tooltip, { placement: "auto", content: newGrafanaVersion },
                        React.createElement("a", { href: "https://grafana.com/get", target: "_blank" }, "New version available!"))))))));
});
export default Footer;
//# sourceMappingURL=Footer.js.map
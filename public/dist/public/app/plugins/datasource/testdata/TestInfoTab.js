import { __extends } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { LinkButton } from '@grafana/ui';
var TestInfoTab = /** @class */ (function (_super) {
    __extends(TestInfoTab, _super);
    function TestInfoTab(props) {
        return _super.call(this, props) || this;
    }
    TestInfoTab.prototype.render = function () {
        return (React.createElement("div", null,
            "See github for more information about setting up a reproducible test environment.",
            React.createElement("br", null),
            React.createElement("br", null),
            React.createElement(LinkButton, { variant: "secondary", href: "https://github.com/grafana/grafana/tree/main/devenv", target: "_blank", rel: "noopener noreferrer" }, "GitHub"),
            React.createElement("br", null)));
    };
    return TestInfoTab;
}(PureComponent));
export { TestInfoTab };
//# sourceMappingURL=TestInfoTab.js.map
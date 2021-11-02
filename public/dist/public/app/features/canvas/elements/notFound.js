import { __extends } from "tslib";
import React, { PureComponent } from 'react';
var NotFoundDisplay = /** @class */ (function (_super) {
    __extends(NotFoundDisplay, _super);
    function NotFoundDisplay() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    NotFoundDisplay.prototype.render = function () {
        var config = this.props.config;
        return (React.createElement("div", null,
            React.createElement("h3", null, "NOT FOUND:"),
            React.createElement("pre", null, JSON.stringify(config, null, 2))));
    };
    return NotFoundDisplay;
}(PureComponent));
export var notFoundItem = {
    id: 'not-found',
    name: 'Not found',
    description: 'Display when element type is not found in the registry',
    display: NotFoundDisplay,
    defaultSize: {
        width: 100,
        height: 100,
    },
    getNewOptions: function () { return ({
        config: {},
    }); },
};
//# sourceMappingURL=notFound.js.map
import * as tslib_1 from "tslib";
import React from 'react';
var Project = /** @class */ (function (_super) {
    tslib_1.__extends(Project, _super);
    function Project() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            projectName: 'Loading project...',
        };
        return _this;
    }
    Project.prototype.componentDidMount = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var projectName;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.datasource.getDefaultProject()];
                    case 1:
                        projectName = _a.sent();
                        this.setState({ projectName: projectName });
                        return [2 /*return*/];
                }
            });
        });
    };
    Project.prototype.render = function () {
        var projectName = this.state.projectName;
        return (React.createElement("div", { className: "gf-form" },
            React.createElement("span", { className: "gf-form-label width-9 query-keyword" }, "Project"),
            React.createElement("input", { className: "gf-form-input width-15", disabled: true, type: "text", value: projectName })));
    };
    return Project;
}(React.Component));
export { Project };
//# sourceMappingURL=Project.js.map
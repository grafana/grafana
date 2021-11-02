import { __assign, __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Button, Input, Form, Field } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { createNewFolder } from '../state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import validationSrv from '../../manage-dashboards/services/ValidationSrv';
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'manage-dashboards'),
}); };
var mapDispatchToProps = {
    createNewFolder: createNewFolder,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var initialFormModel = { folderName: '' };
var NewDashboardsFolder = /** @class */ (function (_super) {
    __extends(NewDashboardsFolder, _super);
    function NewDashboardsFolder() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onSubmit = function (formData) {
            _this.props.createNewFolder(formData.folderName);
        };
        _this.validateFolderName = function (folderName) {
            return validationSrv
                .validateNewFolderName(folderName)
                .then(function () {
                return true;
            })
                .catch(function (e) {
                return e.message;
            });
        };
        return _this;
    }
    NewDashboardsFolder.prototype.render = function () {
        var _this = this;
        return (React.createElement(Page, { navModel: this.props.navModel },
            React.createElement(Page.Contents, null,
                React.createElement("h3", null, "New dashboard folder"),
                React.createElement(Form, { defaultValues: initialFormModel, onSubmit: this.onSubmit }, function (_a) {
                    var register = _a.register, errors = _a.errors;
                    return (React.createElement(React.Fragment, null,
                        React.createElement(Field, { label: "Folder name", invalid: !!errors.folderName, error: errors.folderName && errors.folderName.message },
                            React.createElement(Input, __assign({ id: "folder-name-input" }, register('folderName', {
                                required: 'Folder name is required.',
                                validate: function (v) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.validateFolderName(v)];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                }); }); },
                            })))),
                        React.createElement(Button, { type: "submit" }, "Create")));
                }))));
    };
    return NewDashboardsFolder;
}(PureComponent));
export { NewDashboardsFolder };
export default connector(NewDashboardsFolder);
//# sourceMappingURL=NewDashboardsFolder.js.map
import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Button, LegacyForms } from '@grafana/ui';
var Input = LegacyForms.Input;
import Page from 'app/core/components/Page/Page';
import appEvents from 'app/core/app_events';
import { getNavModel } from 'app/core/selectors/navModel';
import { deleteFolder, getFolderByUid, saveFolder } from './state/actions';
import { getLoadingNav } from './state/navModel';
import { setFolderTitle } from './state/reducers';
import { ShowConfirmModalEvent } from '../../types/events';
var mapStateToProps = function (state, props) {
    var uid = props.match.params.uid;
    return {
        navModel: getNavModel(state.navIndex, "folder-settings-" + uid, getLoadingNav(2)),
        folderUid: uid,
        folder: state.folder,
    };
};
var mapDispatchToProps = {
    getFolderByUid: getFolderByUid,
    saveFolder: saveFolder,
    setFolderTitle: setFolderTitle,
    deleteFolder: deleteFolder,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var FolderSettingsPage = /** @class */ (function (_super) {
    __extends(FolderSettingsPage, _super);
    function FolderSettingsPage(props) {
        var _this = _super.call(this, props) || this;
        _this.onTitleChange = function (evt) {
            _this.props.setFolderTitle(evt.target.value);
        };
        _this.onSave = function (evt) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        evt.preventDefault();
                        evt.stopPropagation();
                        this.setState({ isLoading: true });
                        return [4 /*yield*/, this.props.saveFolder(this.props.folder)];
                    case 1:
                        _a.sent();
                        this.setState({ isLoading: false });
                        return [2 /*return*/];
                }
            });
        }); };
        _this.onDelete = function (evt) {
            evt.stopPropagation();
            evt.preventDefault();
            var confirmationText = "Do you want to delete this folder and all its dashboards and alerts?";
            appEvents.publish(new ShowConfirmModalEvent({
                title: 'Delete',
                text: confirmationText,
                icon: 'trash-alt',
                yesText: 'Delete',
                onConfirm: function () {
                    _this.props.deleteFolder(_this.props.folder.uid);
                },
            }));
        };
        _this.state = {
            isLoading: false,
        };
        return _this;
    }
    FolderSettingsPage.prototype.componentDidMount = function () {
        this.props.getFolderByUid(this.props.folderUid);
    };
    FolderSettingsPage.prototype.render = function () {
        var _a = this.props, navModel = _a.navModel, folder = _a.folder;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: this.state.isLoading },
                React.createElement("h3", { className: "page-sub-heading" }, "Folder settings"),
                React.createElement("div", { className: "section gf-form-group" },
                    React.createElement("form", { name: "folderSettingsForm", onSubmit: this.onSave },
                        React.createElement("div", { className: "gf-form" },
                            React.createElement("label", { className: "gf-form-label width-7" }, "Name"),
                            React.createElement(Input, { type: "text", className: "gf-form-input width-30", value: folder.title, onChange: this.onTitleChange })),
                        React.createElement("div", { className: "gf-form-button-row" },
                            React.createElement(Button, { type: "submit", disabled: !folder.canSave || !folder.hasChanged }, "Save"),
                            React.createElement(Button, { variant: "destructive", onClick: this.onDelete, disabled: !folder.canSave }, "Delete")))))));
    };
    return FolderSettingsPage;
}(PureComponent));
export { FolderSettingsPage };
export default connector(FolderSettingsPage);
//# sourceMappingURL=FolderSettingsPage.js.map
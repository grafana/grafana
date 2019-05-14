import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import Page from 'app/core/components/Page/Page';
import appEvents from 'app/core/app_events';
import { getNavModel } from 'app/core/selectors/navModel';
import { getFolderByUid, setFolderTitle, saveFolder, deleteFolder } from './state/actions';
import { getLoadingNav } from './state/navModel';
var FolderSettingsPage = /** @class */ (function (_super) {
    tslib_1.__extends(FolderSettingsPage, _super);
    function FolderSettingsPage(props) {
        var _this = _super.call(this, props) || this;
        _this.onTitleChange = function (evt) {
            _this.props.setFolderTitle(evt.target.value);
        };
        _this.onSave = function (evt) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
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
            appEvents.emit('confirm-modal', {
                title: 'Delete',
                text: "Do you want to delete this folder and all its dashboards?",
                icon: 'fa-trash',
                yesText: 'Delete',
                onConfirm: function () {
                    _this.props.deleteFolder(_this.props.folder.uid);
                },
            });
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
                React.createElement("h2", { className: "page-sub-heading" }, "Folder Settings"),
                React.createElement("div", { className: "section gf-form-group" },
                    React.createElement("form", { name: "folderSettingsForm", onSubmit: this.onSave },
                        React.createElement("div", { className: "gf-form" },
                            React.createElement("label", { className: "gf-form-label width-7" }, "Name"),
                            React.createElement("input", { type: "text", className: "gf-form-input width-30", value: folder.title, onChange: this.onTitleChange })),
                        React.createElement("div", { className: "gf-form-button-row" },
                            React.createElement("button", { type: "submit", className: "btn btn-primary", disabled: !folder.canSave || !folder.hasChanged }, "Save"),
                            React.createElement("button", { className: "btn btn-danger", onClick: this.onDelete, disabled: !folder.canSave }, "Delete")))))));
    };
    return FolderSettingsPage;
}(PureComponent));
export { FolderSettingsPage };
var mapStateToProps = function (state) {
    var uid = state.location.routeParams.uid;
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
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(FolderSettingsPage));
//# sourceMappingURL=FolderSettingsPage.js.map
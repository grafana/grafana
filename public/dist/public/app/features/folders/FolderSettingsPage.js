import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Button, LegacyForms } from '@grafana/ui';
const { Input } = LegacyForms;
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { ShowConfirmModalEvent } from '../../types/events';
import { deleteFolder, getFolderByUid, saveFolder } from './state/actions';
import { getLoadingNav } from './state/navModel';
import { setFolderTitle } from './state/reducers';
const mapStateToProps = (state, props) => {
    const uid = props.match.params.uid;
    return {
        pageNav: getNavModel(state.navIndex, `folder-settings-${uid}`, getLoadingNav(2)),
        folderUid: uid,
        folder: state.folder,
    };
};
const mapDispatchToProps = {
    getFolderByUid,
    saveFolder,
    setFolderTitle,
    deleteFolder,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export class FolderSettingsPage extends PureComponent {
    constructor(props) {
        super(props);
        this.onTitleChange = (evt) => {
            this.props.setFolderTitle(evt.target.value);
        };
        this.onSave = (evt) => __awaiter(this, void 0, void 0, function* () {
            evt.preventDefault();
            evt.stopPropagation();
            this.setState({ isLoading: true });
            yield this.props.saveFolder(this.props.folder);
            this.setState({ isLoading: false });
        });
        this.onDelete = (evt) => {
            evt.stopPropagation();
            evt.preventDefault();
            const confirmationText = `Do you want to delete this folder and all its dashboards and alerts?`;
            appEvents.publish(new ShowConfirmModalEvent({
                title: 'Delete',
                text: confirmationText,
                icon: 'trash-alt',
                yesText: 'Delete',
                onConfirm: () => {
                    this.props.deleteFolder(this.props.folder.uid);
                },
            }));
        };
        this.state = {
            isLoading: false,
        };
    }
    componentDidMount() {
        this.props.getFolderByUid(this.props.folderUid);
    }
    render() {
        const { pageNav, folder } = this.props;
        return (React.createElement(Page, { navId: "dashboards/browse", pageNav: pageNav.main },
            React.createElement(Page.Contents, { isLoading: this.state.isLoading },
                React.createElement("h3", { className: "page-sub-heading" }, "Folder settings"),
                React.createElement("div", { className: "section gf-form-group" },
                    React.createElement("form", { name: "folderSettingsForm", onSubmit: this.onSave },
                        React.createElement("div", { className: "gf-form" },
                            React.createElement("label", { htmlFor: "folder-title", className: "gf-form-label width-7" }, "Name"),
                            React.createElement(Input, { type: "text", className: "gf-form-input width-30", id: "folder-title", value: folder.title, onChange: this.onTitleChange })),
                        React.createElement("div", { className: "gf-form-button-row" },
                            React.createElement(Button, { type: "submit", disabled: !folder.canSave || !folder.hasChanged }, "Save"),
                            React.createElement(Button, { variant: "destructive", onClick: this.onDelete, disabled: !folder.canDelete }, "Delete")))))));
    }
}
export default connector(FolderSettingsPage);
//# sourceMappingURL=FolderSettingsPage.js.map
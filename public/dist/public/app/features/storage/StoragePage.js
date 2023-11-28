import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import { isDataFrame } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useStyles2, Spinner, TabsBar, Tab, Button, HorizontalGroup, Alert, toIconName } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { ShowConfirmModalEvent } from 'app/types/events';
import { AddRootView } from './AddRootView';
import { Breadcrumb } from './Breadcrumb';
import { CreateNewFolderModal } from './CreateNewFolderModal';
import { FileView } from './FileView';
import { FolderView } from './FolderView';
import { RootView } from './RootView';
import { UploadButton } from './UploadButton';
import { getGrafanaStorage, filenameAlreadyExists } from './storage';
import { StorageView } from './types';
const folderNameRegex = /^[a-z\d!\-_.*'() ]+$/;
const folderNameMaxLength = 256;
const getParentPath = (path) => {
    const lastSlashIdx = path.lastIndexOf('/');
    if (lastSlashIdx < 1) {
        return '';
    }
    return path.substring(0, lastSlashIdx);
};
export default function StoragePage(props) {
    var _a, _b;
    const styles = useStyles2(getStyles);
    const navModel = useNavModel('storage');
    const path = (_a = props.match.params.path) !== null && _a !== void 0 ? _a : '';
    const view = (_b = props.queryParams.view) !== null && _b !== void 0 ? _b : StorageView.Data;
    const setPath = (p, view) => {
        let url = ('/admin/storage/' + p).replace('//', '/');
        if (view && view !== StorageView.Data) {
            url += '?view=' + view;
        }
        locationService.push(url);
    };
    const [isAddingNewFolder, setIsAddingNewFolder] = useState(false);
    const [errorMessages, setErrorMessages] = useState([]);
    const listing = useAsync(() => {
        return getGrafanaStorage()
            .list(path)
            .then((frame) => {
            if (frame) {
                const name = frame.fields[0];
                frame.fields[0] = Object.assign(Object.assign({}, name), { getLinks: (cfg) => {
                        var _a;
                        const n = name.values[(_a = cfg.valueRowIndex) !== null && _a !== void 0 ? _a : 0];
                        const p = path + '/' + n;
                        return [
                            {
                                title: `Open ${n}`,
                                href: `/admin/storage/${p}`,
                                target: '_self',
                                origin: name,
                                onClick: () => {
                                    setPath(p);
                                },
                            },
                        ];
                    } });
            }
            return frame;
        });
    }, [path]);
    const isFolder = useMemo(() => {
        let isFolder = (path === null || path === void 0 ? void 0 : path.indexOf('/')) < 0;
        if (listing.value) {
            const length = listing.value.length;
            if (length === 1) {
                const first = listing.value.fields[0].values[0];
                isFolder = !path.endsWith(first);
            }
            else {
                // TODO: handle files/folders which do not exist
                isFolder = true;
            }
        }
        return isFolder;
    }, [path, listing]);
    const fileNames = useMemo(() => {
        var _a, _b, _c, _d;
        return (_d = (_c = (_b = (_a = listing.value) === null || _a === void 0 ? void 0 : _a.fields) === null || _b === void 0 ? void 0 : _b.find((f) => f.name === 'name')) === null || _c === void 0 ? void 0 : _c.values.filter((v) => typeof v === 'string')) !== null && _d !== void 0 ? _d : [];
    }, [listing]);
    const renderView = () => {
        var _a;
        const isRoot = !(path === null || path === void 0 ? void 0 : path.length) || path === '/';
        switch (view) {
            case StorageView.AddRoot:
                if (!isRoot) {
                    setPath('');
                    return React.createElement(Spinner, null);
                }
                return React.createElement(AddRootView, { onPathChange: setPath });
        }
        const frame = listing.value;
        if (!isDataFrame(frame)) {
            return React.createElement(React.Fragment, null);
        }
        if (isRoot) {
            return React.createElement(RootView, { root: frame, onPathChange: setPath });
        }
        const opts = [{ what: StorageView.Data, text: 'Data' }];
        // Root folders have a config page
        if (path.indexOf('/') < 0) {
            opts.push({ what: StorageView.Config, text: 'Configure' });
        }
        // Lets only apply permissions to folders (for now)
        if (isFolder) {
            // opts.push({ what: StorageView.Perms, text: 'Permissions' });
        }
        else {
            // TODO: only if the file exists in a storage engine with
            opts.push({ what: StorageView.History, text: 'History' });
        }
        const canAddFolder = isFolder && (path.startsWith('resources') || path.startsWith('content'));
        const canDelete = path.startsWith('resources/') || path.startsWith('content/');
        const getErrorMessages = () => {
            return (React.createElement("div", { className: styles.errorAlert },
                React.createElement(Alert, { title: "Upload failed", severity: "error", onRemove: clearAlert }, errorMessages.map((error) => {
                    return React.createElement("div", { key: error }, error);
                }))));
        };
        const clearAlert = () => {
            setErrorMessages([]);
        };
        return (React.createElement("div", { className: styles.wrapper },
            React.createElement(HorizontalGroup, { width: "100%", justify: "space-between", spacing: 'md', height: 25 },
                React.createElement(Breadcrumb, { pathName: path, onPathChange: setPath, rootIcon: toIconName((_a = navModel.node.icon) !== null && _a !== void 0 ? _a : '') }),
                React.createElement(HorizontalGroup, null,
                    canAddFolder && (React.createElement(React.Fragment, null,
                        React.createElement(UploadButton, { path: path, setErrorMessages: setErrorMessages, fileNames: fileNames, setPath: setPath }),
                        React.createElement(Button, { onClick: () => setIsAddingNewFolder(true) }, "New Folder"))),
                    canDelete && (React.createElement(Button, { variant: "destructive", onClick: () => {
                            const text = isFolder
                                ? 'Are you sure you want to delete this folder and all its contents?'
                                : 'Are you sure you want to delete this file?';
                            const parentPath = getParentPath(path);
                            appEvents.publish(new ShowConfirmModalEvent({
                                title: `Delete ${isFolder ? 'folder' : 'file'}`,
                                text,
                                icon: 'trash-alt',
                                yesText: 'Delete',
                                onConfirm: () => getGrafanaStorage()
                                    .delete({ path, isFolder })
                                    .then(() => {
                                    setPath(parentPath);
                                }),
                            }));
                        } }, "Delete")))),
            errorMessages.length > 0 && getErrorMessages(),
            React.createElement(TabsBar, null, opts.map((opt) => (React.createElement(Tab, { key: opt.what, label: opt.text, active: opt.what === view, onChangeTab: () => setPath(path, opt.what) })))),
            isFolder ? (React.createElement(FolderView, { listing: frame, view: view })) : (React.createElement(FileView, { path: path, listing: frame, onPathChange: setPath, view: view })),
            isAddingNewFolder && (React.createElement(CreateNewFolderModal, { onSubmit: ({ folderName }) => __awaiter(this, void 0, void 0, function* () {
                    const folderPath = `${path}/${folderName}`;
                    const res = yield getGrafanaStorage().createFolder(folderPath);
                    if (typeof (res === null || res === void 0 ? void 0 : res.error) !== 'string') {
                        setPath(folderPath);
                        setIsAddingNewFolder(false);
                    }
                }), onDismiss: () => {
                    setIsAddingNewFolder(false);
                }, validate: (folderName) => {
                    const lowerCase = folderName.toLowerCase();
                    if (filenameAlreadyExists(folderName, fileNames)) {
                        return 'A file or a folder with the same name already exists';
                    }
                    if (!folderNameRegex.test(lowerCase)) {
                        return 'Name contains illegal characters';
                    }
                    if (folderName.length > folderNameMaxLength) {
                        return `Name is too long, maximum length: ${folderNameMaxLength} characters`;
                    }
                    return true;
                } }))));
    };
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, { isLoading: listing.loading }, renderView())));
}
const getStyles = (theme) => ({
    // TODO: remove `height: 90%`
    wrapper: css `
    display: flex;
    flex-direction: column;
    height: 100%;
  `,
    tableControlRowWrapper: css `
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-bottom: ${theme.spacing(2)};
  `,
    // TODO: remove `height: 100%`
    tableWrapper: css `
    border: 1px solid ${theme.colors.border.medium};
    height: 100%;
  `,
    border: css `
    border: 1px solid ${theme.colors.border.medium};
    padding: ${theme.spacing(2)};
  `,
    errorAlert: css `
    padding-top: 20px;
  `,
    uploadButton: css `
    margin-right: ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=StoragePage.js.map
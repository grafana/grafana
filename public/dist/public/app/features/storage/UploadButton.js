import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { ConfirmModal, FileUpload, useStyles2 } from '@grafana/ui';
import { filenameAlreadyExists, getGrafanaStorage } from './storage';
const fileFormats = 'image/jpg, image/jpeg, image/png, image/gif, image/webp';
export function UploadButton({ setErrorMessages, setPath, path, fileNames }) {
    const styles = useStyles2(getStyles);
    const [file, setFile] = useState(undefined);
    const [filenameExists, setFilenameExists] = useState(false);
    const [fileUploadKey, setFileUploadKey] = useState(1);
    const [isConfirmOpen, setIsConfirmOpen] = useState(true);
    useEffect(() => {
        setFileUploadKey((prev) => prev + 1);
    }, [file]);
    const onUpload = (rsp) => {
        console.log('Uploaded: ' + path);
        if (rsp.path) {
            setPath(rsp.path);
        }
        else {
            setPath(path); // back to data
        }
    };
    const doUpload = (fileToUpload, overwriteExistingFile) => __awaiter(this, void 0, void 0, function* () {
        if (!fileToUpload) {
            setErrorMessages(['Please select a file.']);
            return;
        }
        const rsp = yield getGrafanaStorage().upload(path, fileToUpload, overwriteExistingFile);
        if (rsp.status !== 200) {
            setErrorMessages([rsp.message]);
        }
        else {
            onUpload(rsp);
        }
    });
    const onFileUpload = (event) => {
        setErrorMessages([]);
        const fileToUpload = event.currentTarget.files && event.currentTarget.files.length > 0 && event.currentTarget.files[0]
            ? event.currentTarget.files[0]
            : undefined;
        if (fileToUpload) {
            setFile(fileToUpload);
            const fileExists = filenameAlreadyExists(fileToUpload.name, fileNames);
            if (!fileExists) {
                setFilenameExists(false);
                doUpload(fileToUpload, false).then((r) => { });
            }
            else {
                setFilenameExists(true);
                setIsConfirmOpen(true);
            }
        }
    };
    const onOverwriteConfirm = () => {
        if (file) {
            doUpload(file, true).then((r) => { });
            setIsConfirmOpen(false);
        }
    };
    const onOverwriteDismiss = () => {
        setFile(undefined);
        setFilenameExists(false);
        setIsConfirmOpen(false);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(FileUpload, { accept: fileFormats, onFileUpload: onFileUpload, key: fileUploadKey, className: styles.uploadButton }, "Upload"),
        file && filenameExists && (React.createElement(ConfirmModal, { isOpen: isConfirmOpen, body: React.createElement("div", null,
                React.createElement("p", null, file === null || file === void 0 ? void 0 : file.name),
                React.createElement("p", null, "A file with this name already exists."),
                React.createElement("p", null, "What would you like to do?")), title: 'This file already exists', confirmText: 'Replace', onConfirm: onOverwriteConfirm, onDismiss: onOverwriteDismiss }))));
}
const getStyles = (theme) => ({
    uploadButton: css `
    margin-right: ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=UploadButton.js.map
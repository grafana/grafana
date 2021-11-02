import { __assign, __makeTemplateObject, __read, __spreadArray, __values } from "tslib";
import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTheme2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { FileListItem } from './FileListItem';
export function FileDropzone(_a) {
    var options = _a.options, children = _a.children, readAs = _a.readAs, onLoad = _a.onLoad, fileListRenderer = _a.fileListRenderer;
    var _b = __read(useState([]), 2), files = _b[0], setFiles = _b[1];
    var setFileProperty = useCallback(function (customFile, action) {
        setFiles(function (oldFiles) {
            return oldFiles.map(function (oldFile) {
                if (oldFile.id === customFile.id) {
                    action(oldFile);
                    return oldFile;
                }
                return oldFile;
            });
        });
    }, []);
    var onDrop = useCallback(function (acceptedFiles, rejectedFiles, event) {
        var e_1, _a;
        var customFiles = acceptedFiles.map(mapToCustomFile);
        if ((options === null || options === void 0 ? void 0 : options.multiple) === false) {
            setFiles(customFiles);
        }
        else {
            setFiles(function (oldFiles) { return __spreadArray(__spreadArray([], __read(oldFiles), false), __read(customFiles), false); });
        }
        if (options === null || options === void 0 ? void 0 : options.onDrop) {
            options.onDrop(acceptedFiles, rejectedFiles, event);
        }
        else {
            var _loop_1 = function (customFile) {
                var reader = new FileReader();
                var read = function () {
                    if (readAs) {
                        reader[readAs](customFile.file);
                    }
                    else {
                        reader.readAsText(customFile.file);
                    }
                };
                // Set abort FileReader
                setFileProperty(customFile, function (fileToModify) {
                    fileToModify.abortUpload = function () {
                        reader.abort();
                    };
                    fileToModify.retryUpload = function () {
                        setFileProperty(customFile, function (fileToModify) {
                            fileToModify.error = null;
                            fileToModify.progress = undefined;
                        });
                        read();
                    };
                });
                reader.onabort = function () {
                    setFileProperty(customFile, function (fileToModify) {
                        fileToModify.error = new DOMException('Aborted');
                    });
                };
                reader.onprogress = function (event) {
                    setFileProperty(customFile, function (fileToModify) {
                        fileToModify.progress = event.loaded;
                    });
                };
                reader.onload = function () {
                    onLoad === null || onLoad === void 0 ? void 0 : onLoad(reader.result);
                };
                reader.onerror = function () {
                    setFileProperty(customFile, function (fileToModify) {
                        fileToModify.error = reader.error;
                    });
                };
                read();
            };
            try {
                for (var customFiles_1 = __values(customFiles), customFiles_1_1 = customFiles_1.next(); !customFiles_1_1.done; customFiles_1_1 = customFiles_1.next()) {
                    var customFile = customFiles_1_1.value;
                    _loop_1(customFile);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (customFiles_1_1 && !customFiles_1_1.done && (_a = customFiles_1.return)) _a.call(customFiles_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
    }, [onLoad, options, readAs, setFileProperty]);
    var removeFile = function (file) {
        var newFiles = files.filter(function (f) { return file.id !== f.id; });
        setFiles(newFiles);
    };
    var _c = useDropzone(__assign(__assign({}, options), { onDrop: onDrop })), getRootProps = _c.getRootProps, getInputProps = _c.getInputProps, isDragActive = _c.isDragActive;
    var theme = useTheme2();
    var styles = getStyles(theme, isDragActive);
    var fileList = files.map(function (file) {
        if (fileListRenderer) {
            return fileListRenderer(file, removeFile);
        }
        return React.createElement(FileListItem, { key: file.id, file: file, removeFile: removeFile });
    });
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", __assign({ "data-testid": "dropzone" }, getRootProps({ className: styles.dropzone })),
            React.createElement("input", __assign({}, getInputProps())), children !== null && children !== void 0 ? children : React.createElement(FileDropzoneDefaultChildren, { primaryText: getPrimaryText(files, options) })),
        (options === null || options === void 0 ? void 0 : options.accept) && (React.createElement("small", { className: cx(styles.small, styles.acceptMargin) }, getAcceptedFileTypeText(options))),
        fileList));
}
export function FileDropzoneDefaultChildren(_a) {
    var _b = _a.primaryText, primaryText = _b === void 0 ? 'Upload file' : _b, _c = _a.secondaryText, secondaryText = _c === void 0 ? 'Drag and drop here or browse' : _c;
    var theme = useTheme2();
    var styles = getStyles(theme);
    return (React.createElement("div", { className: styles.iconWrapper },
        React.createElement(Icon, { name: "upload", size: "xxl" }),
        React.createElement("h3", null, primaryText),
        React.createElement("small", { className: styles.small }, secondaryText)));
}
function getPrimaryText(files, options) {
    if ((options === null || options === void 0 ? void 0 : options.multiple) === undefined || (options === null || options === void 0 ? void 0 : options.multiple)) {
        return 'Upload file';
    }
    return files.length ? 'Replace file' : 'Upload file';
}
function getAcceptedFileTypeText(options) {
    if (Array.isArray(options.accept)) {
        return "Accepted file types: " + options.accept.join(', ');
    }
    return "Accepted file type: " + options.accept;
}
function mapToCustomFile(file) {
    return {
        id: uniqueId('file'),
        file: file,
        error: null,
    };
}
function getStyles(theme, isDragActive) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      width: 100%;\n    "], ["\n      display: flex;\n      flex-direction: column;\n      width: 100%;\n    "]))),
        dropzone: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      flex: 1;\n      flex-direction: column;\n      align-items: center;\n      padding: ", ";\n      border-radius: 2px;\n      border: 2px dashed ", ";\n      background-color: ", ";\n      cursor: pointer;\n    "], ["\n      display: flex;\n      flex: 1;\n      flex-direction: column;\n      align-items: center;\n      padding: ", ";\n      border-radius: 2px;\n      border: 2px dashed ", ";\n      background-color: ", ";\n      cursor: pointer;\n    "])), theme.spacing(6), theme.colors.border.medium, isDragActive ? theme.colors.background.secondary : theme.colors.background.primary),
        iconWrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      align-items: center;\n    "], ["\n      display: flex;\n      flex-direction: column;\n      align-items: center;\n    "]))),
        acceptMargin: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      margin: ", ";\n    "], ["\n      margin: ", ";\n    "])), theme.spacing(2, 0, 1)),
        small: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.colors.text.secondary),
    };
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=FileDropzone.js.map
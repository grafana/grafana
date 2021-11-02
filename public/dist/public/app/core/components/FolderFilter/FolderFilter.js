import { __assign, __awaiter, __generator, __makeTemplateObject, __read, __values } from "tslib";
import React, { useCallback, useMemo, useState } from 'react';
import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import { AsyncMultiSelect, Icon, resetSelectStyles, useStyles2 } from '@grafana/ui';
import { PermissionLevelString } from 'app/types';
import { getBackendSrv } from 'app/core/services/backend_srv';
export function FolderFilter(_a) {
    var propsOnChange = _a.onChange, maxMenuHeight = _a.maxMenuHeight;
    var styles = useStyles2(getStyles);
    var _b = __read(useState(false), 2), loading = _b[0], setLoading = _b[1];
    var getOptions = useCallback(function (searchString) { return getFoldersAsOptions(searchString, setLoading); }, []);
    var debouncedLoadOptions = useMemo(function () { return debounce(getOptions, 300); }, [getOptions]);
    var _c = __read(useState([]), 2), value = _c[0], setValue = _c[1];
    var onChange = useCallback(function (folders) {
        var e_1, _a;
        var changedFolders = [];
        try {
            for (var folders_1 = __values(folders), folders_1_1 = folders_1.next(); !folders_1_1.done; folders_1_1 = folders_1.next()) {
                var folder = folders_1_1.value;
                if (folder.value) {
                    changedFolders.push(folder.value);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (folders_1_1 && !folders_1_1.done && (_a = folders_1.return)) _a.call(folders_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        propsOnChange(changedFolders);
        setValue(folders);
    }, [propsOnChange]);
    var selectOptions = {
        defaultOptions: true,
        isMulti: true,
        noOptionsMessage: 'No folders found',
        placeholder: 'Filter by folder',
        styles: resetSelectStyles(),
        maxMenuHeight: maxMenuHeight,
        value: value,
        onChange: onChange,
    };
    return (React.createElement("div", { className: styles.container },
        value.length > 0 && (React.createElement("span", { className: styles.clear, onClick: function () { return onChange([]); } }, "Clear folders")),
        React.createElement(AsyncMultiSelect, __assign({ menuShouldPortal: true }, selectOptions, { isLoading: loading, loadOptions: debouncedLoadOptions, prefix: React.createElement(Icon, { name: "filter" }), "aria-label": "Folder filter" }))));
}
function getFoldersAsOptions(searchString, setLoading) {
    return __awaiter(this, void 0, void 0, function () {
        var params, searchHits, options;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoading(true);
                    params = {
                        query: searchString,
                        type: 'dash-folder',
                        permission: PermissionLevelString.View,
                    };
                    return [4 /*yield*/, getBackendSrv().search(params)];
                case 1:
                    searchHits = _a.sent();
                    options = searchHits.map(function (d) { return ({ label: d.title, value: { id: d.id, title: d.title } }); });
                    if (!searchString || 'general'.includes(searchString.toLowerCase())) {
                        options.unshift({ label: 'General', value: { id: 0, title: 'General' } });
                    }
                    setLoading(false);
                    return [2 /*return*/, options];
            }
        });
    });
}
function getStyles(theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: container;\n      position: relative;\n      min-width: 180px;\n      flex-grow: 1;\n    "], ["\n      label: container;\n      position: relative;\n      min-width: 180px;\n      flex-grow: 1;\n    "]))),
        clear: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: clear;\n      text-decoration: underline;\n      font-size: ", ";\n      position: absolute;\n      top: -", ";\n      right: 0;\n      cursor: pointer;\n      color: ", ";\n\n      &:hover {\n        color: ", ";\n      }\n    "], ["\n      label: clear;\n      text-decoration: underline;\n      font-size: ", ";\n      position: absolute;\n      top: -", ";\n      right: 0;\n      cursor: pointer;\n      color: ", ";\n\n      &:hover {\n        color: ", ";\n      }\n    "])), theme.spacing(1.5), theme.spacing(2.75), theme.colors.text.link, theme.colors.text.maxContrast),
    };
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=FolderFilter.js.map
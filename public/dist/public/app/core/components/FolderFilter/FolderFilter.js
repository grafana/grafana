import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import React, { useCallback, useMemo, useState } from 'react';
import { AsyncMultiSelect, Icon, Button, useStyles2 } from '@grafana/ui';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { DashboardSearchItemType } from 'app/features/search/types';
import { PermissionLevelString } from 'app/types';
export function FolderFilter({ onChange, maxMenuHeight }) {
    const styles = useStyles2(getStyles);
    const [loading, setLoading] = useState(false);
    const getOptions = useCallback((searchString) => getFoldersAsOptions(searchString, setLoading), []);
    const debouncedLoadOptions = useMemo(() => debounce(getOptions, 300), [getOptions]);
    const [value, setValue] = useState([]);
    const onSelectOptionChange = useCallback((folders) => {
        const changedFolderIds = folders.filter((f) => Boolean(f.value)).map((f) => f.value);
        onChange(changedFolderIds);
        setValue(folders);
    }, [onChange]);
    return (React.createElement("div", { className: styles.container },
        value.length > 0 && (React.createElement(Button, { size: "xs", icon: "trash-alt", fill: "text", className: styles.clear, onClick: () => onChange([]), "aria-label": "Clear folders" }, "Clear folders")),
        React.createElement(AsyncMultiSelect, { value: value, onChange: onSelectOptionChange, isLoading: loading, loadOptions: debouncedLoadOptions, maxMenuHeight: maxMenuHeight, placeholder: "Filter by folder", noOptionsMessage: "No folders found", prefix: React.createElement(Icon, { name: "filter" }), "aria-label": "Folder filter", defaultOptions: true })));
}
function getFoldersAsOptions(searchString, setLoading) {
    return __awaiter(this, void 0, void 0, function* () {
        setLoading(true);
        const params = {
            query: searchString,
            type: DashboardSearchItemType.DashFolder,
            permission: PermissionLevelString.View,
        };
        // FIXME: stop using id from search and use UID instead
        const searchHits = yield getBackendSrv().search(params);
        const options = searchHits.map((d) => ({ label: d.title, value: { uid: d.uid, title: d.title } }));
        if (!searchString || 'general'.includes(searchString.toLowerCase())) {
            options.unshift({ label: 'General', value: { uid: 'general', title: 'General' } });
        }
        setLoading(false);
        return options;
    });
}
function getStyles(theme) {
    return {
        container: css `
      label: container;
      position: relative;
      min-width: 180px;
      flex-grow: 1;
    `,
        clear: css `
      label: clear;
      font-size: ${theme.spacing(1.5)};
      position: absolute;
      top: -${theme.spacing(4.5)};
      right: 0;
    `,
    };
}
//# sourceMappingURL=FolderFilter.js.map
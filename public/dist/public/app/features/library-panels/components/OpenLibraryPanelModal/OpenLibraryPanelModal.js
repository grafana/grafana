import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { AsyncSelect, Button, Modal, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { getConnectedDashboards, getLibraryPanelConnectedDashboards } from '../../state/api';
export function OpenLibraryPanelModal({ libraryPanel, onDismiss }) {
    const styles = useStyles2(getStyles);
    const [loading, setLoading] = useState(false);
    const [connected, setConnected] = useState(0);
    const [option, setOption] = useState(undefined);
    useEffect(() => {
        const getConnected = () => __awaiter(this, void 0, void 0, function* () {
            const connectedDashboards = yield getLibraryPanelConnectedDashboards(libraryPanel.uid);
            setConnected(connectedDashboards.length);
        });
        getConnected();
    }, [libraryPanel.uid]);
    const loadOptions = useCallback((searchString) => loadOptionsAsync(libraryPanel.uid, searchString, setLoading), [libraryPanel.uid]);
    const debouncedLoadOptions = useMemo(() => debounce(loadOptions, 300, { leading: true }), [loadOptions]);
    const onViewPanel = (e) => {
        var _a;
        e.preventDefault();
        locationService.push(urlUtil.renderUrl(`/d/${(_a = option === null || option === void 0 ? void 0 : option.value) === null || _a === void 0 ? void 0 : _a.uid}`, {}));
    };
    return (React.createElement(Modal, { title: t('library-panels.modal.title', 'View panel in dashboard'), onDismiss: onDismiss, onClickBackdrop: onDismiss, isOpen: true },
        React.createElement("div", { className: styles.container },
            connected === 0 ? (React.createElement("span", null,
                React.createElement(Trans, { i18nKey: 'library-panels.modal.panel-not-linked' }, "Panel is not linked to a dashboard. Add the panel to a dashboard and retry."))) : null,
            connected > 0 ? (React.createElement(React.Fragment, null,
                React.createElement("p", null,
                    React.createElement(Trans, { i18nKey: "library-panels.modal.body", count: connected },
                        "This panel is being used in ",
                        { count: connected },
                        " dashboard. Please choose which dashboard to view the panel in:")),
                React.createElement(AsyncSelect, { isClearable: true, isLoading: loading, defaultOptions: true, loadOptions: debouncedLoadOptions, onChange: setOption, placeholder: t('library-panels.modal.select-placeholder', 'Start typing to search for dashboard'), noOptionsMessage: t('library-panels.modal.select-no-options-message', 'No dashboards found') }))) : null),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" },
                React.createElement(Trans, { i18nKey: 'library-panels.modal.button-cancel' }, "Cancel")),
            React.createElement(Button, { onClick: onViewPanel, disabled: !Boolean(option) }, option
                ? t('library-panels.modal.button-view-panel1', 'View panel in {{label}}...', { label: option === null || option === void 0 ? void 0 : option.label })
                : t('library-panels.modal.button-view-panel2', 'View panel in dashboard...')))));
}
function loadOptionsAsync(uid, searchString, setLoading) {
    return __awaiter(this, void 0, void 0, function* () {
        setLoading(true);
        const searchHits = yield getConnectedDashboards(uid);
        const options = searchHits
            .filter((d) => d.title.toLowerCase().includes(searchString.toLowerCase()))
            .map((d) => ({ label: d.title, value: d }));
        setLoading(false);
        return options;
    });
}
function getStyles(theme) {
    return {
        container: css ``,
    };
}
//# sourceMappingURL=OpenLibraryPanelModal.js.map
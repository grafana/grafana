import { __awaiter } from "tslib";
import React, { useCallback, useState } from 'react';
import { useAsync, useDebounce } from 'react-use';
import { Button, Icon, Input, Modal, useStyles2 } from '@grafana/ui';
import { getConnectedDashboards } from '../../state/api';
import { getModalStyles } from '../../styles';
import { usePanelSave } from '../../utils/usePanelSave';
export const SaveLibraryPanelModal = ({ panel, folderUid, isUnsavedPrompt, onDismiss, onConfirm, onDiscard, }) => {
    var _a, _b;
    const [searchString, setSearchString] = useState('');
    const dashState = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        const searchHits = yield getConnectedDashboards(panel.libraryPanel.uid);
        if (searchHits.length > 0) {
            return searchHits.map((dash) => dash.title);
        }
        return [];
    }), [panel.libraryPanel.uid]);
    const [filteredDashboards, setFilteredDashboards] = useState([]);
    useDebounce(() => {
        if (!dashState.value) {
            return setFilteredDashboards([]);
        }
        return setFilteredDashboards(dashState.value.filter((dashName) => dashName.toLowerCase().includes(searchString.toLowerCase())));
    }, 300, [dashState.value, searchString]);
    const { saveLibraryPanel } = usePanelSave();
    const styles = useStyles2(getModalStyles);
    const discardAndClose = useCallback(() => {
        onDiscard();
    }, [onDiscard]);
    const title = isUnsavedPrompt ? 'Unsaved library panel changes' : 'Save library panel';
    return (React.createElement(Modal, { title: title, icon: "save", onDismiss: onDismiss, isOpen: true },
        React.createElement("div", null,
            React.createElement("p", { className: styles.textInfo },
                'This update will affect ',
                React.createElement("strong", null, (_a = panel.libraryPanel.meta) === null || _a === void 0 ? void 0 :
                    _a.connectedDashboards,
                    ' ',
                    ((_b = panel.libraryPanel.meta) === null || _b === void 0 ? void 0 : _b.connectedDashboards) === 1 ? 'dashboard' : 'dashboards',
                    "."),
                "The following dashboards using the panel will be affected:"),
            React.createElement(Input, { className: styles.dashboardSearch, prefix: React.createElement(Icon, { name: "search" }), placeholder: "Search affected dashboards", value: searchString, onChange: (e) => setSearchString(e.currentTarget.value) }),
            dashState.loading ? (React.createElement("p", null, "Loading connected dashboards...")) : (React.createElement("table", { className: styles.myTable },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Dashboard name"))),
                React.createElement("tbody", null, filteredDashboards.map((dashName, i) => (React.createElement("tr", { key: `dashrow-${i}` },
                    React.createElement("td", null, dashName))))))),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" }, "Cancel"),
                isUnsavedPrompt && (React.createElement(Button, { variant: "destructive", onClick: discardAndClose }, "Discard")),
                React.createElement(Button, { onClick: () => {
                        saveLibraryPanel(panel, folderUid).then(() => {
                            onConfirm();
                        });
                    } }, "Update all")))));
};
//# sourceMappingURL=SaveLibraryPanelModal.js.map
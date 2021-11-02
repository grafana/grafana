import { __awaiter, __generator, __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { css } from '@emotion/css';
import { Button, useStyles2, VerticalGroup } from '@grafana/ui';
import { AddLibraryPanelModal } from '../AddLibraryPanelModal/AddLibraryPanelModal';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';
import { changeToLibraryPanel } from 'app/features/panel/state/actions';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { ChangeLibraryPanelModal } from '../ChangeLibraryPanelModal/ChangeLibraryPanelModal';
import { PanelTypeFilter } from '../../../../core/components/PanelTypeFilter/PanelTypeFilter';
export var PanelLibraryOptionsGroup = function (_a) {
    var _b;
    var panel = _a.panel, searchQuery = _a.searchQuery;
    var styles = useStyles2(getStyles);
    var _c = __read(useState(false), 2), showingAddPanelModal = _c[0], setShowingAddPanelModal = _c[1];
    var _d = __read(useState(undefined), 2), changeToPanel = _d[0], setChangeToPanel = _d[1];
    var _e = __read(useState([]), 2), panelFilter = _e[0], setPanelFilter = _e[1];
    var onPanelFilterChange = useCallback(function (plugins) {
        setPanelFilter(plugins.map(function (p) { return p.id; }));
    }, [setPanelFilter]);
    var dashboard = getDashboardSrv().getCurrent();
    var dispatch = useDispatch();
    var useLibraryPanel = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!changeToPanel) {
                return [2 /*return*/];
            }
            setChangeToPanel(undefined);
            dispatch(changeToLibraryPanel(panel, changeToPanel));
            return [2 /*return*/];
        });
    }); };
    var onAddToPanelLibrary = function () {
        setShowingAddPanelModal(true);
    };
    var onChangeLibraryPanel = function (panel) {
        setChangeToPanel(panel);
    };
    var onDismissChangeToPanel = function () {
        setChangeToPanel(undefined);
    };
    return (React.createElement(VerticalGroup, { spacing: "md" },
        !panel.libraryPanel && (React.createElement(VerticalGroup, { align: "center" },
            React.createElement(Button, { icon: "plus", onClick: onAddToPanelLibrary, variant: "secondary", fullWidth: true }, "Create new library panel"))),
        React.createElement(PanelTypeFilter, { onChange: onPanelFilterChange }),
        React.createElement("div", { className: styles.libraryPanelsView },
            React.createElement(LibraryPanelsView, { currentPanelId: (_b = panel.libraryPanel) === null || _b === void 0 ? void 0 : _b.uid, searchString: searchQuery, panelFilter: panelFilter, onClickCard: onChangeLibraryPanel, showSecondaryActions: true })),
        showingAddPanelModal && (React.createElement(AddLibraryPanelModal, { panel: panel, onDismiss: function () { return setShowingAddPanelModal(false); }, initialFolderId: dashboard === null || dashboard === void 0 ? void 0 : dashboard.meta.folderId, isOpen: showingAddPanelModal })),
        changeToPanel && (React.createElement(ChangeLibraryPanelModal, { panel: panel, onDismiss: onDismissChangeToPanel, onConfirm: useLibraryPanel }))));
};
var getStyles = function (theme) {
    return {
        libraryPanelsView: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: 100%;\n    "], ["\n      width: 100%;\n    "]))),
    };
};
var templateObject_1;
//# sourceMappingURL=PanelLibraryOptionsGroup.js.map
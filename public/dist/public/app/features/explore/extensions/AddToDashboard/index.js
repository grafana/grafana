import React, { useCallback, useState } from 'react';
import { Modal, ToolbarButton } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { useSelector } from 'app/types';
import { getExploreItemSelector } from '../../state/selectors';
import { AddToDashboardForm } from './AddToDashboardForm';
import { getAddToDashboardTitle } from './getAddToDashboardTitle';
export const AddToDashboard = ({ exploreId }) => {
    var _a, _b;
    const [isOpen, setIsOpen] = useState(false);
    const selectExploreItem = getExploreItemSelector(exploreId);
    const explorePaneHasQueries = !!((_b = (_a = useSelector(selectExploreItem)) === null || _a === void 0 ? void 0 : _a.queries) === null || _b === void 0 ? void 0 : _b.length);
    const onClose = useCallback(() => setIsOpen(false), []);
    const addToDashboardLabel = t('explore.add-to-dashboard', 'Add to dashboard');
    return (React.createElement(React.Fragment, null,
        React.createElement(ToolbarButton, { icon: "apps", variant: "canvas", onClick: () => setIsOpen(true), "aria-label": addToDashboardLabel, disabled: !explorePaneHasQueries }, addToDashboardLabel),
        isOpen && (React.createElement(Modal, { title: getAddToDashboardTitle(), onDismiss: onClose, isOpen: true },
            React.createElement(AddToDashboardForm, { onClose: onClose, exploreId: exploreId })))));
};
//# sourceMappingURL=index.js.map
import React from 'react';
import { ClickOutsideWrapper } from '@grafana/ui';
import { PanelHeaderMenuProvider } from './PanelHeaderMenuProvider';
import { PanelHeaderMenu } from './PanelHeaderMenu';
export var PanelHeaderMenuWrapper = function (_a) {
    var show = _a.show, onClose = _a.onClose, panel = _a.panel, dashboard = _a.dashboard;
    if (!show) {
        return null;
    }
    return (React.createElement(ClickOutsideWrapper, { onClick: onClose, parent: document },
        React.createElement(PanelHeaderMenuProvider, { panel: panel, dashboard: dashboard }, function (_a) {
            var items = _a.items;
            return React.createElement(PanelHeaderMenu, { items: items });
        })));
};
//# sourceMappingURL=PanelHeaderMenuWrapper.js.map
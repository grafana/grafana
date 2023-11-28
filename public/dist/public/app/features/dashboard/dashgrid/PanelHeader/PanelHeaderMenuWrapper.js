import React from 'react';
import { PanelHeaderMenu } from './PanelHeaderMenu';
import { PanelHeaderMenuProvider } from './PanelHeaderMenuProvider';
export function PanelHeaderMenuWrapper({ style, panel, dashboard, loadingState }) {
    return (React.createElement(PanelHeaderMenuProvider, { panel: panel, dashboard: dashboard, loadingState: loadingState }, ({ items }) => React.createElement(PanelHeaderMenu, { style: style, items: items })));
}
//# sourceMappingURL=PanelHeaderMenuWrapper.js.map
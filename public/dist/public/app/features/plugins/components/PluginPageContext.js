import React from 'react';
export const PluginPageContext = React.createContext(getInitialPluginPageContext());
PluginPageContext.displayName = 'PluginPageContext';
function getInitialPluginPageContext() {
    return {
        sectionNav: {
            main: { text: 'Plugin page' },
            node: { text: 'Plugin page' },
        },
    };
}
export function buildPluginPageContext(sectionNav) {
    return {
        sectionNav: sectionNav !== null && sectionNav !== void 0 ? sectionNav : getInitialPluginPageContext().sectionNav,
    };
}
//# sourceMappingURL=PluginPageContext.js.map
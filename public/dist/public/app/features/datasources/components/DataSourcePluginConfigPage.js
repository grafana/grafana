import React from 'react';
export function DataSourcePluginConfigPage({ plugin, pageId }) {
    if (!plugin || !plugin.configPages) {
        return null;
    }
    const page = plugin.configPages.find(({ id }) => id === pageId);
    if (page) {
        // TODO: Investigate if any plugins are using this? We should change this interface
        return React.createElement(page.body, { plugin: plugin, query: {} });
    }
    return React.createElement("div", null,
        "Page not found: ",
        page);
}
//# sourceMappingURL=DataSourcePluginConfigPage.js.map
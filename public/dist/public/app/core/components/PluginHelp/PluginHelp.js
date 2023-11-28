import { __awaiter } from "tslib";
import React from 'react';
import { useAsync } from 'react-use';
import { renderMarkdown } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { LoadingPlaceholder } from '@grafana/ui';
export function PluginHelp({ pluginId }) {
    const { value, loading, error } = useAsync(() => __awaiter(this, void 0, void 0, function* () {
        return getBackendSrv().get(`/api/plugins/${pluginId}/markdown/query_help`);
    }), []);
    const renderedMarkdown = renderMarkdown(value);
    if (loading) {
        return React.createElement(LoadingPlaceholder, { text: "Loading help..." });
    }
    if (error) {
        return React.createElement("h3", null, "An error occurred when loading help.");
    }
    if (value === '') {
        return React.createElement("h3", null, "No query help could be found.");
    }
    return React.createElement("div", { className: "markdown-html", dangerouslySetInnerHTML: { __html: renderedMarkdown } });
}
//# sourceMappingURL=PluginHelp.js.map
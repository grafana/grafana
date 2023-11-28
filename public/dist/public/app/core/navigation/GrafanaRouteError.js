import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { locationUtil, PageLayoutType } from '@grafana/data';
import { Button, ErrorWithStack, stylesFactory } from '@grafana/ui';
import { Page } from '../components/Page/Page';
export function GrafanaRouteError({ error, errorInfo }) {
    const location = useLocation();
    const isChunkLoadingError = (error === null || error === void 0 ? void 0 : error.name) === 'ChunkLoadError';
    useEffect(() => {
        // Auto reload page 1 time if we have a chunk load error
        if (isChunkLoadingError && location.search.indexOf('chunkNotFound') === -1) {
            window.location.href = locationUtil.getUrlForPartial(location, { chunkNotFound: true });
        }
    }, [location, isChunkLoadingError]);
    // Would be good to know the page navId here but needs a pretty big refactoring
    return (React.createElement(Page, { navId: "error", layout: PageLayoutType.Canvas },
        React.createElement("div", { className: getStyles() },
            isChunkLoadingError && (React.createElement("div", null,
                React.createElement("h2", null, "Unable to find application file"),
                React.createElement("br", null),
                React.createElement("h2", { className: "page-heading" }, "Grafana has likely been updated. Please try reloading the page."),
                React.createElement("br", null),
                React.createElement("div", { className: "gf-form-group" },
                    React.createElement(Button, { size: "md", variant: "secondary", icon: "repeat", onClick: () => window.location.reload() }, "Reload")),
                React.createElement(ErrorWithStack, { title: 'Error details', error: error, errorInfo: errorInfo }))),
            !isChunkLoadingError && (React.createElement(ErrorWithStack, { title: 'An unexpected error happened', error: error, errorInfo: errorInfo })))));
}
const getStyles = stylesFactory(() => {
    return css `
    width: 500px;
    margin: 64px auto;
  `;
});
//# sourceMappingURL=GrafanaRouteError.js.map
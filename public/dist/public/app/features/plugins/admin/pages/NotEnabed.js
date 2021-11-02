import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Page as PluginPage } from '../components/Page';
import { Page } from 'app/core/components/Page/Page';
var node = {
    id: 'not-found',
    text: 'The plugin catalog is not enabled',
    icon: 'exclamation-triangle',
    url: 'not-found',
};
var navModel = { node: node, main: node };
export default function NotEnabled() {
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement(PluginPage, null,
                "To enable installing plugins via catalog, please refer to the",
                ' ',
                React.createElement("a", { className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n              text-decoration: underline;\n            "], ["\n              text-decoration: underline;\n            "]))), href: "https://grafana.com/docs/grafana/latest/plugins/catalog" }, "Plugin Catalog"),
                ' ',
                "instructions"))));
}
var templateObject_1;
//# sourceMappingURL=NotEnabed.js.map
import React from 'react';
import { Link } from 'react-router-dom';
import { getAppRoutes } from '../../routes/routes';
import { PageContents } from '../components/Page/PageContents';
export var RouterDebugger = function () {
    var manualRoutes = [];
    return (React.createElement(PageContents, null,
        React.createElement("h1", null, "Static routes"),
        React.createElement("ul", null, getAppRoutes().map(function (r, i) {
            if (r.path.indexOf(':') > -1 || r.path.indexOf('test') > -1) {
                if (r.path.indexOf('test') === -1) {
                    manualRoutes.push(r);
                }
                return null;
            }
            return (React.createElement("li", { key: i },
                React.createElement(Link, { target: "_blank", to: r.path }, r.path)));
        })),
        React.createElement("h1", null, "Dynamic routes - check those manually"),
        React.createElement("ul", null, manualRoutes.map(function (r, i) {
            return (React.createElement("li", { key: i },
                React.createElement(Link, { key: i + "-" + r.path, target: "_blank", to: r.path }, r.path)));
        }))));
};
//# sourceMappingURL=RouterDebugger.js.map
import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { RouterDebugger } from './RouterDebugger';
export var testRoutes = [
    {
        path: '/test1',
        // eslint-disable-next-line react/display-name
        component: function () {
            return (React.createElement(React.Fragment, null,
                React.createElement("h1", null, "Test1"),
                React.createElement(Link, { to: '/test2' }, "Test2 link"),
                React.createElement(NavLink, { to: '/test2' }, "Test2 navlink")));
        },
    },
    {
        path: '/test2',
        // eslint-disable-next-line react/display-name
        component: function () { return (React.createElement(React.Fragment, null,
            React.createElement("h1", null, "Test2 "),
            React.createElement(Link, { to: '/test1' }, "Test1 link"),
            React.createElement(NavLink, { to: '/test1' }, "Test1 navlink"))); },
    },
    {
        path: '/router-debug',
        // eslint-disable-next-line react/display-name
        component: function () { return RouterDebugger; },
    },
];
//# sourceMappingURL=testRoutes.js.map
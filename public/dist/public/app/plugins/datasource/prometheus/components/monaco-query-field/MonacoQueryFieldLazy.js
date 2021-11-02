import { __assign } from "tslib";
import React, { Suspense } from 'react';
var Field = React.lazy(function () { return import(/* webpackChunkName: "prom-query-field" */ './MonacoQueryField'); });
export var MonacoQueryFieldLazy = function (props) {
    return (React.createElement(Suspense, { fallback: null },
        React.createElement(Field, __assign({}, props))));
};
//# sourceMappingURL=MonacoQueryFieldLazy.js.map
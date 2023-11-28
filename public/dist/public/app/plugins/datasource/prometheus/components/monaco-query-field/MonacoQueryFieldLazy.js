import React, { Suspense } from 'react';
const Field = React.lazy(() => import(/* webpackChunkName: "prom-query-field" */ './MonacoQueryField'));
export const MonacoQueryFieldLazy = (props) => {
    return (React.createElement(Suspense, { fallback: null },
        React.createElement(Field, Object.assign({}, props))));
};
//# sourceMappingURL=MonacoQueryFieldLazy.js.map
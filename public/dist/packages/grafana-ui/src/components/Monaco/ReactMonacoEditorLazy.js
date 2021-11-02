import { __assign } from "tslib";
import React from 'react';
import { useAsyncDependency } from '../../utils/useAsyncDependency';
import { ErrorWithStack, LoadingPlaceholder } from '..';
/**
 * @internal
 * Experimental export
 **/
export var ReactMonacoEditorLazy = function (props) {
    var _a = useAsyncDependency(import(/* webpackChunkName: "react-monaco-editor" */ './ReactMonacoEditor')), loading = _a.loading, error = _a.error, dependency = _a.dependency;
    if (loading) {
        return React.createElement(LoadingPlaceholder, { text: '' });
    }
    if (error) {
        return (React.createElement(ErrorWithStack, { title: "React Monaco Editor failed to load", error: error, errorInfo: { componentStack: (error === null || error === void 0 ? void 0 : error.stack) || '' } }));
    }
    var ReactMonacoEditor = dependency.ReactMonacoEditor;
    return React.createElement(ReactMonacoEditor, __assign({}, props));
};
//# sourceMappingURL=ReactMonacoEditorLazy.js.map
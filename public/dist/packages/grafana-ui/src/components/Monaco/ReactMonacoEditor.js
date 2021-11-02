import { __assign } from "tslib";
import React, { useEffect } from 'react';
import MonacoEditor, { loader as monacoEditorLoader, useMonaco } from '@monaco-editor/react';
import defineThemes from './theme';
import { useTheme2 } from '../../themes';
var initalized = false;
function initMonaco() {
    var _a;
    if (initalized) {
        return;
    }
    monacoEditorLoader.config({
        paths: {
            vs: ((_a = window.__grafana_public_path__) !== null && _a !== void 0 ? _a : 'public/') + 'lib/monaco/min/vs',
        },
    });
    initalized = true;
    monacoEditorLoader.init().then(function (monaco) {
        // this call makes sure the themes exist.
        // they will not have the correct colors,
        // but we need them to exist since the beginning,
        // because if we start a monaco instance with
        // a theme that does not exist, it will not work well.
        defineThemes(monaco);
    });
}
export var ReactMonacoEditor = function (props) {
    var theme = useTheme2();
    var monaco = useMonaco();
    useEffect(function () {
        // monaco can be null at the beginning, because it is loaded in asynchronously
        if (monaco !== null) {
            defineThemes(monaco, theme);
        }
    }, [monaco, theme]);
    initMonaco();
    var monacoTheme = theme.isDark ? 'grafana-dark' : 'grafana-light';
    return React.createElement(MonacoEditor, __assign({ theme: monacoTheme }, props));
};
//# sourceMappingURL=ReactMonacoEditor.js.map
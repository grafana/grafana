import { __read } from "tslib";
import { CodeEditor } from '@grafana/ui';
import { Deferred } from 'app/core/utils/deferred';
import React, { useCallback, useEffect, useRef } from 'react';
import { setKustoQuery } from './setQueryValue';
var QueryField = function (_a) {
    var _b, _c, _d;
    var query = _a.query, datasource = _a.datasource, onQueryChange = _a.onQueryChange;
    var monacoPromiseRef = useRef();
    function getPromise() {
        if (!monacoPromiseRef.current) {
            monacoPromiseRef.current = new Deferred();
        }
        return monacoPromiseRef.current.promise;
    }
    useEffect(function () {
        var _a;
        if (!((_a = query.azureLogAnalytics) === null || _a === void 0 ? void 0 : _a.resource)) {
            return;
        }
        var promises = [
            datasource.azureLogAnalyticsDatasource.getKustoSchema(query.azureLogAnalytics.resource),
            getPromise(),
        ];
        // the kusto schema call might fail, but its okay for that to happen silently
        Promise.all(promises).then(function (_a) {
            var _b = __read(_a, 2), schema = _b[0], _c = _b[1], monaco = _c.monaco, editor = _c.editor;
            var languages = monaco.languages;
            languages.kusto
                .getKustoWorker()
                .then(function (kusto) {
                var model = editor.getModel();
                return model && kusto(model.uri);
            })
                .then(function (worker) {
                worker === null || worker === void 0 ? void 0 : worker.setSchema(schema, 'https://help.kusto.windows.net', 'Samples');
            });
        });
    }, [datasource.azureLogAnalyticsDatasource, (_b = query.azureLogAnalytics) === null || _b === void 0 ? void 0 : _b.resource]);
    var handleEditorMount = useCallback(function (editor, monaco) {
        var _a, _b;
        (_b = (_a = monacoPromiseRef.current) === null || _a === void 0 ? void 0 : _a.resolve) === null || _b === void 0 ? void 0 : _b.call(_a, { editor: editor, monaco: monaco });
    }, []);
    var onChange = useCallback(function (newQuery) {
        onQueryChange(setKustoQuery(query, newQuery));
    }, [onQueryChange, query]);
    return (React.createElement(CodeEditor, { value: (_d = (_c = query.azureLogAnalytics) === null || _c === void 0 ? void 0 : _c.query) !== null && _d !== void 0 ? _d : '', language: "kusto", height: 200, width: "100%", showMiniMap: false, onBlur: onChange, onSave: onChange, onEditorDidMount: handleEditorMount }));
};
export default QueryField;
//# sourceMappingURL=QueryField.js.map
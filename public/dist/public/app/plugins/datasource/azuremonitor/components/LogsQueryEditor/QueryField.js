import { __awaiter } from "tslib";
import React, { useCallback, useEffect, useState } from 'react';
import { CodeEditor } from '@grafana/ui';
import { setKustoQuery } from './setQueryValue';
const QueryField = ({ query, onQueryChange, schema }) => {
    var _a, _b;
    const [monaco, setMonaco] = useState();
    useEffect(() => {
        if (!schema || !monaco) {
            return;
        }
        const setupEditor = ({ monaco, editor }, schema) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const languages = monaco.languages;
                const model = editor.getModel();
                if (model) {
                    const kustoWorker = yield languages.kusto.getKustoWorker();
                    const kustoMode = yield kustoWorker(model === null || model === void 0 ? void 0 : model.uri);
                    yield kustoMode.setSchema(schema);
                }
            }
            catch (err) {
                console.error(err);
            }
        });
        setupEditor(monaco, schema).catch((err) => console.error(err));
    }, [schema, monaco]);
    const handleEditorMount = useCallback((editor, monaco) => {
        setMonaco({ monaco, editor });
    }, []);
    const onChange = useCallback((newQuery) => {
        onQueryChange(setKustoQuery(query, newQuery));
    }, [onQueryChange, query]);
    return (React.createElement(CodeEditor, { value: (_b = (_a = query.azureLogAnalytics) === null || _a === void 0 ? void 0 : _a.query) !== null && _b !== void 0 ? _b : '', language: "kusto", height: 200, width: "100%", showMiniMap: false, onBlur: onChange, onSave: onChange, onEditorDidMount: handleEditorMount }));
};
export default QueryField;
//# sourceMappingURL=QueryField.js.map
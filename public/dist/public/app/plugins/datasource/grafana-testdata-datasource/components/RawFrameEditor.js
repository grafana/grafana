import { isArray } from 'lodash';
import React, { useState } from 'react';
import { dataFrameToJSON, toDataFrame, toDataFrameDTO } from '@grafana/data';
import { toDataQueryResponse } from '@grafana/runtime';
import { Alert, CodeEditor } from '@grafana/ui';
export const RawFrameEditor = ({ onChange, query }) => {
    var _a;
    const [error, setError] = useState();
    const [warning, setWarning] = useState();
    const onSaveFrames = (rawFrameContent) => {
        var _a;
        try {
            const json = JSON.parse(rawFrameContent);
            if (isArray(json)) {
                setError(undefined);
                setWarning(undefined);
                onChange(Object.assign(Object.assign({}, query), { rawFrameContent }));
                return;
            }
            let data = undefined;
            // Copy paste from panel json
            if (isArray(json.series) && json.state) {
                data = json.series.map((v) => toDataFrameDTO(toDataFrame(v)));
            }
            else {
                // Chek if it is a copy of the raw resuls
                const v = toDataQueryResponse({ data: json });
                if (((_a = v.data) === null || _a === void 0 ? void 0 : _a.length) && !v.error) {
                    data = v.data.map((f) => dataFrameToJSON(f));
                }
            }
            if (data) {
                console.log('Original', json);
                console.log('Save', data);
                setError(undefined);
                setWarning('Converted to direct frame result');
                onChange(Object.assign(Object.assign({}, query), { rawFrameContent: JSON.stringify(data, null, 2) }));
                return;
            }
            setError('Unable to read dataframes in text');
        }
        catch (e) {
            console.log('Error parsing json', e);
            setError('Enter JSON array of data frames (or raw query results body)');
            setWarning(undefined);
        }
    };
    return (React.createElement(React.Fragment, null,
        error && React.createElement(Alert, { title: error, severity: "error" }),
        warning && React.createElement(Alert, { title: warning, severity: "warning" }),
        React.createElement(CodeEditor, { height: 300, language: "json", value: (_a = query.rawFrameContent) !== null && _a !== void 0 ? _a : '[]', onBlur: onSaveFrames, onSave: onSaveFrames, showMiniMap: true, showLineNumbers: true })));
};
//# sourceMappingURL=RawFrameEditor.js.map
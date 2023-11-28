import React from 'react';
import { Stack } from '@grafana/experimental';
export function MetaDataInspector({ data }) {
    return (React.createElement(Stack, { direction: "column" },
        React.createElement("div", null, "Meta data inspector for the TestData data source."),
        data.map((frame, index) => {
            var _a;
            return (React.createElement(React.Fragment, null,
                React.createElement("div", null,
                    "Frame: ",
                    index),
                React.createElement("div", null,
                    "Custom meta: ",
                    React.createElement("br", null),
                    JSON.stringify((_a = frame.meta) === null || _a === void 0 ? void 0 : _a.custom, null, 2))));
        })));
}
//# sourceMappingURL=MetaDataInspector.js.map
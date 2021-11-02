import { __assign } from "tslib";
import React, { memo } from 'react';
import { CoreApp } from '@grafana/data';
import { LokiQueryEditor } from './LokiQueryEditor';
import { LokiQueryEditorForAlerting } from './LokiQueryEditorForAlerting';
export function LokiQueryEditorByApp(props) {
    var app = props.app;
    switch (app) {
        case CoreApp.CloudAlerting:
            return React.createElement(LokiQueryEditorForAlerting, __assign({}, props));
        default:
            return React.createElement(LokiQueryEditor, __assign({}, props));
    }
}
export default memo(LokiQueryEditorByApp);
//# sourceMappingURL=LokiQueryEditorByApp.js.map
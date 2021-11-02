import { __assign } from "tslib";
import React, { memo } from 'react';
import { CoreApp } from '@grafana/data';
import { PromQueryEditor } from './PromQueryEditor';
import { PromQueryEditorForAlerting } from './PromQueryEditorForAlerting';
export function PromQueryEditorByApp(props) {
    var app = props.app;
    switch (app) {
        case CoreApp.CloudAlerting:
            return React.createElement(PromQueryEditorForAlerting, __assign({}, props));
        default:
            return React.createElement(PromQueryEditor, __assign({}, props));
    }
}
export default memo(PromQueryEditorByApp);
//# sourceMappingURL=PromQueryEditorByApp.js.map
import React, { memo } from 'react';
import { CoreApp } from '@grafana/data';
import { LokiQueryEditor } from './LokiQueryEditor';
import { LokiQueryEditorForAlerting } from './LokiQueryEditorForAlerting';
export function LokiQueryEditorByApp(props) {
    const { app } = props;
    switch (app) {
        case CoreApp.CloudAlerting:
            return React.createElement(LokiQueryEditorForAlerting, Object.assign({}, props));
        default:
            return React.createElement(LokiQueryEditor, Object.assign({}, props));
    }
}
export default memo(LokiQueryEditorByApp);
export const testIds = {
    editor: 'loki-editor',
};
//# sourceMappingURL=LokiQueryEditorByApp.js.map
import React, { memo } from 'react';
import { CoreApp } from '@grafana/data';
import { PromQueryEditorSelector } from '../querybuilder/components/PromQueryEditorSelector';
import { PromQueryEditorForAlerting } from './PromQueryEditorForAlerting';
export function PromQueryEditorByApp(props) {
    const { app } = props;
    switch (app) {
        case CoreApp.CloudAlerting:
            return React.createElement(PromQueryEditorForAlerting, Object.assign({}, props));
        default:
            return React.createElement(PromQueryEditorSelector, Object.assign({}, props));
    }
}
export default memo(PromQueryEditorByApp);
//# sourceMappingURL=PromQueryEditorByApp.js.map
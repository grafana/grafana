import React from 'react';
import { RadioButtonGroup } from '@grafana/ui';
import { QueryEditorMode } from './types';
const editorModes = [
    { label: 'Builder', value: QueryEditorMode.Builder },
    { label: 'Code', value: QueryEditorMode.Code },
];
export function QueryEditorModeToggle({ mode, onChange }) {
    return (React.createElement("div", { "data-testid": 'QueryEditorModeToggle' },
        React.createElement(RadioButtonGroup, { options: editorModes, size: "sm", value: mode, onChange: onChange })));
}
//# sourceMappingURL=QueryEditorModeToggle.js.map
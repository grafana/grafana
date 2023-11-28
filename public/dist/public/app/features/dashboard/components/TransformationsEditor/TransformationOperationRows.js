import React from 'react';
import { standardTransformersRegistry } from '@grafana/data';
import { TransformationOperationRow } from './TransformationOperationRow';
export const TransformationOperationRows = ({ data, onChange, onRemove, configs, }) => {
    return (React.createElement(React.Fragment, null, configs.map((t, i) => {
        const uiConfig = standardTransformersRegistry.getIfExists(t.transformation.id);
        if (!uiConfig) {
            return null;
        }
        return (React.createElement(TransformationOperationRow, { index: i, id: `${t.id}`, key: `${t.id}`, data: data, configs: configs, uiConfig: uiConfig, onRemove: onRemove, onChange: onChange }));
    })));
};
//# sourceMappingURL=TransformationOperationRows.js.map
import React from 'react';
import { Icon } from '@grafana/ui';
import { ResourceRowType } from './types';
export const EntryIcon = ({ isOpen, entry: { type } }) => {
    switch (type) {
        case ResourceRowType.Subscription:
            return React.createElement(Icon, { name: "layer-group" });
        case ResourceRowType.ResourceGroup:
            return React.createElement(Icon, { name: isOpen ? 'folder-open' : 'folder' });
        case ResourceRowType.Resource:
            return React.createElement(Icon, { name: "cube" });
        case ResourceRowType.VariableGroup:
            return React.createElement(Icon, { name: "x" });
        case ResourceRowType.Variable:
            return React.createElement(Icon, { name: "x" });
        default:
            return null;
    }
};
//# sourceMappingURL=EntryIcon.js.map
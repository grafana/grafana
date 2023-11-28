import React from 'react';
import { Switch } from '@grafana/ui';
export function PaginationEditor({ onChange, value, context }) {
    const changeValue = (event) => {
        if (event === null || event === void 0 ? void 0 : event.currentTarget.checked) {
            context.options.footer.show = false;
        }
        onChange(event === null || event === void 0 ? void 0 : event.currentTarget.checked);
    };
    return React.createElement(Switch, { value: Boolean(value), onChange: changeValue });
}
//# sourceMappingURL=PaginationEditor.js.map
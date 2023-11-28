import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Checkbox, Field } from '@grafana/ui';
export const GrafanaCommonChannelSettings = ({ pathPrefix, className, readOnly = false, }) => {
    const { register } = useFormContext();
    return (React.createElement("div", { className: className },
        React.createElement(Field, null,
            React.createElement(Checkbox, Object.assign({}, register(`${pathPrefix}disableResolveMessage`), { label: "Disable resolved message", description: "Disable the resolve message [OK] that is sent when alerting state returns to false", disabled: readOnly })))));
};
//# sourceMappingURL=GrafanaCommonChannelSettings.js.map
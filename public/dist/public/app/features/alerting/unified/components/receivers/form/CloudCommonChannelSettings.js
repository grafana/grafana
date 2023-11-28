import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Checkbox, Field } from '@grafana/ui';
export const CloudCommonChannelSettings = ({ pathPrefix, className, readOnly = false, }) => {
    const { register } = useFormContext();
    return (React.createElement("div", { className: className },
        React.createElement(Field, { disabled: readOnly },
            React.createElement(Checkbox, Object.assign({}, register(`${pathPrefix}sendResolved`), { label: "Send resolved", disabled: readOnly, description: "Whether or not to notify about resolved alerts." })))));
};
//# sourceMappingURL=CloudCommonChannelSettings.js.map
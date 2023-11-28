import { debounce } from 'lodash';
import React, { useState } from 'react';
import { EditorField } from '@grafana/experimental';
import { Input } from '@grafana/ui';
export const AliasBy = ({ refId, value = '', onChange }) => {
    const [alias, setAlias] = useState(value !== null && value !== void 0 ? value : '');
    const propagateOnChange = debounce(onChange, 1000);
    onChange = (e) => {
        setAlias(e.target.value);
        propagateOnChange(e.target.value);
    };
    return (React.createElement(EditorField, { label: "Alias by" },
        React.createElement(Input, { id: `${refId}-alias-by`, value: alias, onChange: onChange })));
};
//# sourceMappingURL=AliasBy.js.map
import React, { useEffect, useMemo, useState } from 'react';
import { FieldValidationMessage, MultiSelect } from '@grafana/ui';
import { selectors } from '../../e2e/selectors';
import { findOptions } from '../../utils/common';
import { Field } from '../Field';
const SubscriptionField = ({ query, subscriptions, variableOptionGroup, onQueryChange }) => {
    const [error, setError] = useState(false);
    const [values, setValues] = useState([]);
    const options = useMemo(() => [...subscriptions, variableOptionGroup], [subscriptions, variableOptionGroup]);
    useEffect(() => {
        if (query.subscriptions && query.subscriptions.length > 0) {
            setValues(findOptions([...subscriptions, ...variableOptionGroup.options], query.subscriptions));
            setError(false);
        }
        else {
            setError(true);
        }
    }, [query.subscriptions, subscriptions, variableOptionGroup.options]);
    const onChange = (change) => {
        if (!change || change.length === 0) {
            setValues([]);
            onQueryChange(Object.assign(Object.assign({}, query), { subscriptions: [] }));
            setError(true);
        }
        else {
            const newSubs = change.map((c) => { var _a; return (_a = c.value) !== null && _a !== void 0 ? _a : ''; });
            onQueryChange(Object.assign(Object.assign({}, query), { subscriptions: newSubs }));
            setValues(findOptions([...subscriptions, ...variableOptionGroup.options], newSubs));
            setError(false);
        }
    };
    return (React.createElement(Field, { label: "Subscriptions", "data-testid": selectors.components.queryEditor.argsQueryEditor.subscriptions.input },
        React.createElement(React.Fragment, null,
            React.createElement(MultiSelect, { isClearable: true, value: values, inputId: "azure-monitor-subscriptions-field", onChange: onChange, options: options, width: 38 }),
            error ? React.createElement(FieldValidationMessage, null, "At least one subscription must be chosen.") : null)));
};
export default SubscriptionField;
//# sourceMappingURL=SubscriptionField.js.map
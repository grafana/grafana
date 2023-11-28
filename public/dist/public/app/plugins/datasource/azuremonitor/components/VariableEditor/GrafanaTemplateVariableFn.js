import React, { useCallback, useEffect, useState } from 'react';
import { InlineField, Input } from '@grafana/ui';
import { migrateStringQueriesToObjectQueries } from '../../grafanaTemplateVariableFns';
import { AzureQueryType } from '../../types';
const GrafanaTemplateVariableFnInput = ({ query, updateQuery, datasource, }) => {
    var _a;
    const [inputVal, setInputVal] = useState('');
    useEffect(() => {
        var _a;
        setInputVal(((_a = query.grafanaTemplateVariableFn) === null || _a === void 0 ? void 0 : _a.rawQuery) || '');
    }, [(_a = query.grafanaTemplateVariableFn) === null || _a === void 0 ? void 0 : _a.rawQuery]);
    const onRunQuery = useCallback((newQuery) => {
        migrateStringQueriesToObjectQueries(newQuery, { datasource }).then((updatedQuery) => {
            if (updatedQuery.queryType === AzureQueryType.GrafanaTemplateVariableFn) {
                updateQuery(updatedQuery);
            }
            else {
                updateQuery(Object.assign(Object.assign({}, query), { grafanaTemplateVariableFn: {
                        kind: 'UnknownQuery',
                        rawQuery: newQuery,
                    } }));
            }
        });
    }, [datasource, query, updateQuery]);
    const onChange = (event) => {
        setInputVal(event.target.value);
    };
    return (React.createElement(InlineField, { label: "Grafana template variable function" },
        React.createElement(Input, { placeholder: 'type a grafana template variable function, ex: Subscriptions()', value: inputVal, onChange: onChange, onBlur: () => onRunQuery(inputVal) })));
};
export default GrafanaTemplateVariableFnInput;
//# sourceMappingURL=GrafanaTemplateVariableFn.js.map
import React, { useCallback, useState } from 'react';
import { t } from 'app/core/internationalization';
import { AdHocFilterKey, REMOVE_FILTER_KEY } from './AdHocFilterKey';
import { AdHocFilterRenderer } from './AdHocFilterRenderer';
export const AdHocFilterBuilder = ({ datasource, appendBefore, onCompleted, allFilters }) => {
    const [key, setKey] = useState(null);
    const [operator, setOperator] = useState('=');
    const onKeyChanged = useCallback((item) => {
        var _a;
        if (item.value !== REMOVE_FILTER_KEY) {
            setKey((_a = item.value) !== null && _a !== void 0 ? _a : '');
            return;
        }
        setKey(null);
    }, [setKey]);
    const onOperatorChanged = useCallback((item) => { var _a; return setOperator((_a = item.value) !== null && _a !== void 0 ? _a : ''); }, [setOperator]);
    const onValueChanged = useCallback((item) => {
        var _a;
        onCompleted({
            value: (_a = item.value) !== null && _a !== void 0 ? _a : '',
            operator: operator,
            key: key,
        });
        setKey(null);
        setOperator('=');
    }, [onCompleted, operator, key]);
    if (key === null) {
        return React.createElement(AdHocFilterKey, { datasource: datasource, filterKey: key, onChange: onKeyChanged, allFilters: allFilters });
    }
    return (React.createElement(React.Fragment, { key: "filter-builder" },
        appendBefore,
        React.createElement(AdHocFilterRenderer, { datasource: datasource, filter: { key, value: '', operator }, placeHolder: t('variable.adhoc.placeholder', 'Select value'), onKeyChange: onKeyChanged, onOperatorChange: onOperatorChanged, onValueChange: onValueChanged, allFilters: allFilters })));
};
//# sourceMappingURL=AdHocFilterBuilder.js.map
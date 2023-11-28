import { __rest } from "tslib";
import React, { useCallback } from 'react';
import { useAsync } from 'react-use';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { dispatch } from 'app/store/store';
import { useRulesSourcesWithRuler } from '../../hooks/useRuleSourcesWithRuler';
import { fetchAllPromBuildInfoAction } from '../../state/actions';
export function CloudRulesSourcePicker(_a) {
    var { value, disabled } = _a, props = __rest(_a, ["value", "disabled"]);
    const rulesSourcesWithRuler = useRulesSourcesWithRuler();
    const { loading = true } = useAsync(() => dispatch(fetchAllPromBuildInfoAction()), [dispatch]);
    const dataSourceFilter = useCallback((ds) => {
        return !!rulesSourcesWithRuler.find(({ id }) => id === ds.id);
    }, [rulesSourcesWithRuler]);
    return (React.createElement(DataSourcePicker, Object.assign({ disabled: loading || disabled, noDefault: true, alerting: true, filter: dataSourceFilter, current: value }, props)));
}
//# sourceMappingURL=CloudRulesSourcePicker.js.map
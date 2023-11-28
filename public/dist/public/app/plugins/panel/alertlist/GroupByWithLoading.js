import { isEmpty, uniq } from 'lodash';
import React, { useEffect, useMemo } from 'react';
import { Icon, MultiSelect } from '@grafana/ui';
import { useUnifiedAlertingSelector } from 'app/features/alerting/unified/hooks/useUnifiedAlertingSelector';
import { fetchAllPromRulesAction } from 'app/features/alerting/unified/state/actions';
import { isAsyncRequestMapSlicePending, isAsyncRequestMapSliceSettled, } from 'app/features/alerting/unified/utils/redux';
import { useDispatch } from 'app/types';
import { PromRuleType } from 'app/types/unified-alerting-dto';
import { fetchPromRulesAction } from '../../../features/alerting/unified/state/actions';
import { isPrivateLabel } from './util';
export const GroupBy = (props) => {
    const { onChange, id, defaultValue, dataSource } = props;
    const dispatch = useDispatch();
    useEffect(() => {
        if (dataSource) {
            dataSource && dispatch(fetchPromRulesAction({ rulesSourceName: dataSource }));
        }
        else {
            dispatch(fetchAllPromRulesAction());
        }
    }, [dispatch, dataSource]);
    const promRulesByDatasource = useUnifiedAlertingSelector((state) => state.promRules);
    const allRequestsReady = isAsyncRequestMapSliceSettled(promRulesByDatasource);
    const loading = isAsyncRequestMapSlicePending(promRulesByDatasource);
    const labels = useMemo(() => {
        if (isEmpty(promRulesByDatasource)) {
            return [];
        }
        if (!allRequestsReady) {
            return [];
        }
        const allLabels = Object.keys(promRulesByDatasource)
            .flatMap((datasource) => { var _a; return (_a = promRulesByDatasource[datasource].result) !== null && _a !== void 0 ? _a : []; })
            .flatMap((rules) => rules.groups)
            .flatMap((group) => group.rules.filter((rule) => rule.type === PromRuleType.Alerting))
            .flatMap((rule) => { var _a; return (_a = rule.alerts) !== null && _a !== void 0 ? _a : []; })
            .map((alert) => { var _a; return Object.keys((_a = alert.labels) !== null && _a !== void 0 ? _a : {}); })
            .flatMap((labels) => labels.filter(isPrivateLabel));
        return uniq(allLabels);
    }, [allRequestsReady, promRulesByDatasource]);
    return (React.createElement(MultiSelect, { id: id, isLoading: loading, defaultValue: defaultValue, "aria-label": 'group by label keys', placeholder: "Group by", prefix: React.createElement(Icon, { name: 'tag-alt' }), onChange: (items) => {
            onChange(items.map((item) => { var _a; return (_a = item.value) !== null && _a !== void 0 ? _a : ''; }));
        }, options: labels.map((key) => ({
            label: key,
            value: key,
        })) }));
};
//# sourceMappingURL=GroupByWithLoading.js.map
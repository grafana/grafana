import { __awaiter } from "tslib";
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useAsync } from 'react-use';
import { locationService } from '@grafana/runtime';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { useDispatch } from '../../../../../types';
import { fetchEditableRuleAction, fetchRulesSourceBuildInfoAction } from '../../state/actions';
import { formValuesFromExistingRule } from '../../utils/rule-form';
import * as ruleId from '../../utils/rule-id';
import { isGrafanaRulerRule } from '../../utils/rules';
import { createUrl } from '../../utils/url';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { ModifyExportRuleForm } from '../rule-editor/alert-rule-form/ModifyExportRuleForm';
export default function GrafanaModifyExport({ match }) {
    var _a;
    const dispatch = useDispatch();
    // Get rule source build info
    const [ruleIdentifier, setRuleIdentifier] = useState(undefined);
    useEffect(() => {
        const identifier = ruleId.tryParse(match.params.id, true);
        setRuleIdentifier(identifier);
    }, [match.params.id]);
    const { loading: loadingBuildInfo = true } = useAsync(() => __awaiter(this, void 0, void 0, function* () {
        if (ruleIdentifier) {
            yield dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName: ruleIdentifier.ruleSourceName }));
        }
    }), [dispatch, ruleIdentifier]);
    // Get rule
    const { loading, value: alertRule, error, } = useAsync(() => __awaiter(this, void 0, void 0, function* () {
        if (!ruleIdentifier) {
            return;
        }
        return yield dispatch(fetchEditableRuleAction(ruleIdentifier)).unwrap();
    }), [ruleIdentifier, loadingBuildInfo]);
    if (!ruleIdentifier) {
        return React.createElement("div", null, "Rule not found");
    }
    if (loading) {
        return React.createElement(LoadingPlaceholder, { text: "Loading the rule" });
    }
    if (error) {
        return (React.createElement(Alert, { title: "Cannot load modify export", severity: "error" }, error.message));
    }
    if (!alertRule && !loading && !loadingBuildInfo) {
        // alert rule does not exist
        return (React.createElement(AlertingPageWrapper, { isLoading: loading, pageId: "alert-list", pageNav: { text: 'Modify export' } },
            React.createElement(Alert, { title: "Cannot load the rule. The rule does not exist", buttonContent: "Go back to alert list", onRemove: () => locationService.replace(createUrl('/alerting/list')) })));
    }
    if (alertRule && !isGrafanaRulerRule(alertRule.rule)) {
        // alert rule exists but is not a grafana-managed rule
        return (React.createElement(AlertingPageWrapper, { isLoading: loading, pageId: "alert-list", pageNav: { text: 'Modify export' } },
            React.createElement(Alert, { title: "This rule is not a Grafana-managed alert rule", buttonContent: "Go back to alert list", onRemove: () => locationService.replace(createUrl('/alerting/list')) })));
    }
    return (React.createElement(AlertingPageWrapper, { isLoading: loading, pageId: "alert-list", pageNav: {
            text: 'Modify export',
            subTitle: 'Modify the current alert rule and export the rule definition in the format of your choice. Any changes you make will not be saved.',
        } }, alertRule && (React.createElement(ModifyExportRuleForm, { ruleForm: formValuesFromExistingRule(alertRule), alertUid: (_a = match.params.id) !== null && _a !== void 0 ? _a : '' }))));
}
//# sourceMappingURL=GrafanaModifyExport.js.map
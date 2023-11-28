import { __awaiter } from "tslib";
import React, { useCallback } from 'react';
import { useAsync } from 'react-use';
import { withErrorBoundary } from '@grafana/ui';
import { useDispatch } from 'app/types';
import { AlertWarning } from './AlertWarning';
import { CloneRuleEditor } from './CloneRuleEditor';
import { ExistingRuleEditor } from './ExistingRuleEditor';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertRuleForm } from './components/rule-editor/alert-rule-form/AlertRuleForm';
import { useURLSearchParams } from './hooks/useURLSearchParams';
import { fetchRulesSourceBuildInfoAction } from './state/actions';
import { useRulesAccess } from './utils/accessControlHooks';
import * as ruleId from './utils/rule-id';
const defaultPageNav = {
    icon: 'bell',
    id: 'alert-rule-view',
};
// sadly we only get the "type" when a new rule is being created, when editing an existing recording rule we can't actually know it from the URL
const getPageNav = (identifier, type) => {
    if (type === 'recording') {
        if (identifier) {
            // this branch should never trigger actually, the type param isn't used when editing rules
            return Object.assign(Object.assign({}, defaultPageNav), { id: 'alert-rule-edit', text: 'Edit recording rule' });
        }
        else {
            return Object.assign(Object.assign({}, defaultPageNav), { id: 'alert-rule-add', text: 'New recording rule' });
        }
    }
    if (identifier) {
        // keep this one ambiguous, don't mentiond a specific alert type here
        return Object.assign(Object.assign({}, defaultPageNav), { id: 'alert-rule-edit', text: 'Edit rule' });
    }
    else {
        return Object.assign(Object.assign({}, defaultPageNav), { id: 'alert-rule-add', text: 'New alert rule' });
    }
};
const RuleEditor = ({ match }) => {
    var _a;
    const dispatch = useDispatch();
    const [searchParams] = useURLSearchParams();
    const { id, type } = match.params;
    const identifier = ruleId.tryParse(id, true);
    const copyFromId = (_a = searchParams.get('copyFrom')) !== null && _a !== void 0 ? _a : undefined;
    const copyFromIdentifier = ruleId.tryParse(copyFromId);
    const { loading = true } = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        if (identifier) {
            yield dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName: identifier.ruleSourceName }));
        }
        if (copyFromIdentifier) {
            yield dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName: copyFromIdentifier.ruleSourceName }));
        }
    }), [dispatch]);
    const { canCreateGrafanaRules, canCreateCloudRules, canEditRules } = useRulesAccess();
    const getContent = useCallback(() => {
        if (loading) {
            return;
        }
        if (!identifier && !canCreateGrafanaRules && !canCreateCloudRules) {
            return React.createElement(AlertWarning, { title: "Cannot create rules" }, "Sorry! You are not allowed to create rules.");
        }
        if (identifier && !canEditRules(identifier.ruleSourceName)) {
            return React.createElement(AlertWarning, { title: "Cannot edit rules" }, "Sorry! You are not allowed to edit rules.");
        }
        if (identifier) {
            return React.createElement(ExistingRuleEditor, { key: id, identifier: identifier, id: id });
        }
        if (copyFromIdentifier) {
            return React.createElement(CloneRuleEditor, { sourceRuleId: copyFromIdentifier });
        }
        // new alert rule
        return React.createElement(AlertRuleForm, null);
    }, [canCreateCloudRules, canCreateGrafanaRules, canEditRules, copyFromIdentifier, id, identifier, loading]);
    return (React.createElement(AlertingPageWrapper, { isLoading: loading, pageId: "alert-list", pageNav: getPageNav(identifier, type) }, getContent()));
};
export default withErrorBoundary(RuleEditor, { style: 'page' });
//# sourceMappingURL=RuleEditor.js.map
import { useCallback } from 'react';
import { useParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { NavModelItem } from '@grafana/data';
import { withErrorBoundary } from '@grafana/ui';
import { useDispatch } from 'app/types';
import { RuleIdentifier } from 'app/types/unified-alerting';

import { AlertWarning } from './AlertWarning';
import { CloneRuleEditor } from './CloneRuleEditor';
import { ExistingRuleEditor } from './ExistingRuleEditor';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertRuleForm } from './components/rule-editor/alert-rule-form/AlertRuleForm';
import { useURLSearchParams } from './hooks/useURLSearchParams';
import { fetchRulesSourceBuildInfoAction } from './state/actions';
import { useRulesAccess } from './utils/accessControlHooks';
import * as ruleId from './utils/rule-id';

type RuleEditorPathParams = {
  id?: string;
  type?: 'recording' | 'alerting' | 'grafana-recording';
};

const defaultPageNav: Partial<NavModelItem> = {
  icon: 'bell',
  id: 'alert-rule-view',
};

// sadly we only get the "type" when a new rule is being created, when editing an existing recording rule we can't actually know it from the URL
const getPageNav = (identifier?: RuleIdentifier, type?: RuleEditorPathParams['type']) => {
  if (type === 'recording' || type === 'grafana-recording') {
    if (identifier) {
      // this branch should never trigger actually, the type param isn't used when editing rules
      return { ...defaultPageNav, id: 'alert-rule-edit', text: 'Edit recording rule' };
    } else {
      return { ...defaultPageNav, id: 'alert-rule-add', text: 'New recording rule' };
    }
  }

  if (identifier) {
    // keep this one ambiguous, don't mentiond a specific alert type here
    return { ...defaultPageNav, id: 'alert-rule-edit', text: 'Edit rule' };
  } else {
    return { ...defaultPageNav, id: 'alert-rule-add', text: 'New alert rule' };
  }
};

const RuleEditor = () => {
  const dispatch = useDispatch();
  const [searchParams] = useURLSearchParams();
  const params = useParams<RuleEditorPathParams>();
  const { type } = params;
  const id = ruleId.getRuleIdFromPathname(params);
  const identifier = ruleId.tryParse(id, true);

  const copyFromId = searchParams.get('copyFrom') ?? undefined;
  const copyFromIdentifier = ruleId.tryParse(copyFromId);

  const { loading = true } = useAsync(async () => {
    if (identifier) {
      await dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName: identifier.ruleSourceName }));
    }
    if (copyFromIdentifier) {
      await dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName: copyFromIdentifier.ruleSourceName }));
    }
  }, [dispatch]);

  const { canCreateGrafanaRules, canCreateCloudRules, canEditRules } = useRulesAccess();

  const getContent = useCallback(() => {
    if (loading) {
      return;
    }

    if (!identifier && !canCreateGrafanaRules && !canCreateCloudRules) {
      return <AlertWarning title="Cannot create rules">Sorry! You are not allowed to create rules.</AlertWarning>;
    }

    if (identifier && !canEditRules(identifier.ruleSourceName)) {
      return <AlertWarning title="Cannot edit rules">Sorry! You are not allowed to edit rules.</AlertWarning>;
    }

    if (identifier) {
      return <ExistingRuleEditor key={id} identifier={identifier} />;
    }

    if (copyFromIdentifier) {
      return <CloneRuleEditor sourceRuleId={copyFromIdentifier} />;
    }
    // new alert rule
    return <AlertRuleForm />;
  }, [canCreateCloudRules, canCreateGrafanaRules, canEditRules, copyFromIdentifier, id, identifier, loading]);

  return (
    <AlertingPageWrapper isLoading={loading} navId="alert-list" pageNav={getPageNav(identifier, type)}>
      {getContent()}
    </AlertingPageWrapper>
  );
};

export default withErrorBoundary(RuleEditor, { style: 'page' });

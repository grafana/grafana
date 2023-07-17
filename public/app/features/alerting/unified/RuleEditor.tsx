import React, { useCallback } from 'react';
import { useAsync } from 'react-use';

import { NavModelItem } from '@grafana/data';
import { withErrorBoundary } from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { useDispatch } from 'app/types';

import { AlertWarning } from './AlertWarning';
import { CloneRuleEditor } from './CloneRuleEditor';
import { ExistingRuleEditor } from './ExistingRuleEditor';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertRuleForm } from './components/rule-editor/AlertRuleForm';
import { useURLSearchParams } from './hooks/useURLSearchParams';
import { fetchRulesSourceBuildInfoAction } from './state/actions';
import { useRulesAccess } from './utils/accessControlHooks';
import * as ruleId from './utils/rule-id';

type RuleEditorProps = GrafanaRouteComponentProps<{ id?: string }>;

const defaultPageNav: Partial<NavModelItem> = {
  icon: 'bell',
  id: 'alert-rule-view',
};

const getPageNav = (state: 'edit' | 'add') => {
  if (state === 'edit') {
    return { ...defaultPageNav, id: 'alert-rule-edit', text: 'Edit rule' };
  } else if (state === 'add') {
    return { ...defaultPageNav, id: 'alert-rule-add', text: 'Add rule' };
  }
  return undefined;
};

const RuleEditor = ({ match }: RuleEditorProps) => {
  const dispatch = useDispatch();
  const [searchParams] = useURLSearchParams();

  const { id } = match.params;
  const identifier = ruleId.tryParse(id, true);

  const copyFromId = searchParams.get('copyFrom') ?? undefined;
  const copyFromIdentifier = ruleId.tryParse(copyFromId);

  const { loading = true } = useAsync(async () => {
    if (identifier) {
      await dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName: identifier.ruleSourceName }));
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
      return <ExistingRuleEditor key={id} identifier={identifier} id={id} />;
    }

    if (copyFromIdentifier) {
      return <CloneRuleEditor sourceRuleId={copyFromIdentifier} />;
    }
    // new alert rule
    return <AlertRuleForm />;
  }, [canCreateCloudRules, canCreateGrafanaRules, canEditRules, copyFromIdentifier, id, identifier, loading]);

  return (
    <AlertingPageWrapper isLoading={loading} pageId="alert-list" pageNav={getPageNav(identifier ? 'edit' : 'add')}>
      {getContent()}
    </AlertingPageWrapper>
  );
};

export default withErrorBoundary(RuleEditor, { style: 'page' });

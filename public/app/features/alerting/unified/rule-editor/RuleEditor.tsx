import { useCallback } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';

import { AlertWarning } from '../AlertWarning';
import { AlertRuleForm } from '../components/rule-editor/alert-rule-form/AlertRuleForm';
import { useURLSearchParams } from '../hooks/useURLSearchParams';
import { useRulesAccess } from '../utils/accessControlHooks';
import * as ruleId from '../utils/rule-id';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

import { CloneRuleEditor } from './CloneRuleEditor';
import { ExistingRuleEditor } from './ExistingRuleEditor';
import { formValuesFromQueryParams, translateRouteParamToRuleType } from './formDefaults';

export type RuleEditorPathParams = {
  id?: string;
  type?: 'recording' | 'alerting' | 'grafana-recording';
};

export const defaultPageNav: Partial<NavModelItem> = {
  id: 'alert-rule-view',
};

const RuleEditor = () => {
  const { identifier } = useRuleEditorPathParams();
  const { copyFromIdentifier, queryDefaults } = useRuleEditorQueryParams();

  const { canCreateGrafanaRules, canCreateCloudRules, canEditRules } = useRulesAccess();

  const getContent = useCallback(() => {
    if (!identifier && !canCreateGrafanaRules && !canCreateCloudRules) {
      return <AlertWarning title="Cannot create rules">Sorry! You are not allowed to create rules.</AlertWarning>;
    }

    if (identifier && !canEditRules(identifier.ruleSourceName)) {
      return <AlertWarning title="Cannot edit rules">Sorry! You are not allowed to edit rules.</AlertWarning>;
    }

    if (identifier) {
      return <ExistingRuleEditor key={JSON.stringify(identifier)} identifier={identifier} />;
    }

    if (copyFromIdentifier) {
      return <CloneRuleEditor sourceRuleId={copyFromIdentifier} />;
    }
    // new alert rule
    return <AlertRuleForm prefill={queryDefaults} />;
  }, [canCreateCloudRules, canCreateGrafanaRules, canEditRules, copyFromIdentifier, identifier, queryDefaults]);

  return getContent();
};

// The pageNav property makes it difficult to only rely on AlertingPageWrapper
// to catch errors.
export default withPageErrorBoundary(RuleEditor);

function useRuleEditorPathParams() {
  const params = useParams<RuleEditorPathParams>();
  const { type } = params;
  const id = ruleId.getRuleIdFromPathname(params);
  const identifier = ruleId.tryParse(id, true);

  return { identifier, type };
}

function useRuleEditorQueryParams() {
  const { type } = useParams<RuleEditorPathParams>();

  const [searchParams] = useURLSearchParams();
  const copyFromId = searchParams.get('copyFrom') ?? undefined;
  const copyFromIdentifier = ruleId.tryParse(copyFromId);

  const ruleType = translateRouteParamToRuleType(type);

  const queryDefaults = searchParams.has('defaults')
    ? formValuesFromQueryParams(searchParams.get('defaults') ?? '', ruleType)
    : undefined;

  return { copyFromIdentifier, queryDefaults };
}

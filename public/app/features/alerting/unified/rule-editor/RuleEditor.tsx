import { useCallback } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { Trans, t } from 'app/core/internationalization';
import { RuleIdentifier } from 'app/types/unified-alerting';

import { AlertWarning } from '../AlertWarning';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { AlertRuleForm } from '../components/rule-editor/alert-rule-form/AlertRuleForm';
import { useURLSearchParams } from '../hooks/useURLSearchParams';
import { useRulesAccess } from '../utils/accessControlHooks';
import * as ruleId from '../utils/rule-id';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

import { CloneRuleEditor } from './CloneRuleEditor';
import { ExistingRuleEditor } from './ExistingRuleEditor';
import { formValuesFromQueryParams, translateRouteParamToRuleType } from './formDefaults';

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
  const { identifier, type } = useRuleEditorPathParams();
  const { copyFromIdentifier, queryDefaults, isManualRestore } = useRuleEditorQueryParams();

  const { canCreateGrafanaRules, canCreateCloudRules, canEditRules } = useRulesAccess();

  const getContent = useCallback(() => {
    if (!identifier && !canCreateGrafanaRules && !canCreateCloudRules) {
      return (
        <AlertWarning title={t('alerting.rule-editor.get-content.title-cannot-create-rules', 'Cannot create rules')}>
          <Trans i18nKey="alerting.rule-editor.get-content.sorry-allowed-create-rules">
            Sorry! You are not allowed to create rules.
          </Trans>
        </AlertWarning>
      );
    }

    if (identifier && !canEditRules(identifier.ruleSourceName)) {
      return (
        <AlertWarning title={t('alerting.rule-editor.get-content.title-cannot-edit-rules', 'Cannot edit rules')}>
          <Trans i18nKey="alerting.rule-editor.get-content.sorry-allowed-rules">
            Sorry! You are not allowed to edit rules.
          </Trans>
        </AlertWarning>
      );
    }

    if (identifier) {
      return <ExistingRuleEditor key={JSON.stringify(identifier)} identifier={identifier} prefill={queryDefaults} />;
    }

    if (copyFromIdentifier) {
      return <CloneRuleEditor sourceRuleId={copyFromIdentifier} />;
    }
    // new alert rule
    return <AlertRuleForm prefill={queryDefaults} isManualRestore={isManualRestore} />;
  }, [
    canCreateCloudRules,
    canCreateGrafanaRules,
    canEditRules,
    copyFromIdentifier,
    identifier,
    queryDefaults,
    isManualRestore,
  ]);

  return (
    <AlertingPageWrapper navId="alert-list" pageNav={getPageNav(identifier, type)}>
      {getContent()}
    </AlertingPageWrapper>
  );
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
  const isManualRestore = searchParams.has('isManualRestore');

  const ruleType = translateRouteParamToRuleType(type);

  const queryDefaults = searchParams.has('defaults')
    ? formValuesFromQueryParams(searchParams.get('defaults') ?? '', ruleType)
    : undefined;

  return { copyFromIdentifier, queryDefaults, isManualRestore };
}

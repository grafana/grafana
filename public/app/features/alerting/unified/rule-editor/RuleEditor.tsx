import { useParams } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { t } from 'app/core/internationalization';

import { AlertWarning } from '../AlertWarning';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { AlertRuleForm } from '../components/rule-editor/alert-rule-form/AlertRuleForm';
import { useURLSearchParams } from '../hooks/useURLSearchParams';
import { useRulesAccess } from '../utils/accessControlHooks';
import * as ruleId from '../utils/rule-id';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

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
  const cloneIdentifier = useIdentifierFromCopy();
  const isManualRestore = useManualRestore();

  const { canCreateGrafanaRules, canCreateCloudRules, canEditRules } = useRulesAccess();

  if (!identifier && !canCreateGrafanaRules && !canCreateCloudRules) {
    return <AlertWarning title="Cannot create rules">Sorry! You are not allowed to create rules.</AlertWarning>;
  }

  if (identifier && !canEditRules(identifier.ruleSourceName)) {
    return <AlertWarning title="Cannot edit rules">Sorry! You are not allowed to edit rules.</AlertWarning>;
  }

  if (identifier) {
    return (
      <ExistingRuleEditor key={JSON.stringify(identifier)} identifier={identifier} isManualRestore={isManualRestore} />
    );
  }

  if (cloneIdentifier) {
    return (
      <ExistingRuleEditor
        key={JSON.stringify(identifier)}
        identifier={cloneIdentifier}
        clone={true}
        isManualRestore={isManualRestore}
      />
    );
  }

  // for new alerting or recording rules
  return <NewRuleEditor />;
};

const RECORDING_TYPE = ['grafana-recording', 'recording'];

/**
 * This one is used for creating new rules (both alerting and recording rules)
 */
function NewRuleEditor() {
  const prefill = useDefaultsFromQuery();
  const isManualRestore = useManualRestore();
  const { type = '', identifier = '' } = useRuleEditorPathParams();

  const entityName = RECORDING_TYPE.includes(type) ? 'recording rule' : 'alert rule';
  const actionName = Boolean(identifier) ? 'Edit' : 'New';

  return (
    <AlertingPageWrapper
      navId="alert-list"
      pageNav={{
        id: 'alert-rule-add',
        text: t('alerting.navigation.editor-title', '{{actionName}} {{entityName}}', { actionName, entityName }),
      }}
    >
      <AlertRuleForm prefill={prefill} isManualRestore={isManualRestore} />
    </AlertingPageWrapper>
  );
}

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

function useIdentifierFromCopy() {
  const [searchParams] = useURLSearchParams();
  const copyFromId = searchParams.get('copyFrom') ?? undefined;

  return ruleId.tryParse(copyFromId);
}

function useDefaultsFromQuery() {
  const { type } = useRuleEditorPathParams();
  const [searchParams] = useURLSearchParams();

  const ruleType = translateRouteParamToRuleType(type);

  const queryDefaults = searchParams.has('defaults')
    ? formValuesFromQueryParams(searchParams.get('defaults') ?? '', ruleType)
    : undefined;

  return queryDefaults;
}

function useManualRestore() {
  const [searchParams] = useURLSearchParams();
  const isManualRestore = searchParams.has('isManualRestore');

  return isManualRestore;
}

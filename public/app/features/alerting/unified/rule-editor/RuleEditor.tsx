import { useParams } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';

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

export const RECORDING_TYPE = ['grafana-recording', 'recording'];

/**
 * This one is used for creating new rules (both alerting and recording rules)
 */
function NewRuleEditor() {
  const prefill = useDefaultsFromQuery();
  const isManualRestore = useManualRestore();
  const { type = '', identifier = '' } = useRuleEditorPathParams();

  const isExisting = Boolean(identifier);
  const isRecordingRule = RECORDING_TYPE.includes(type);

  const newText = isRecordingRule
    ? t('alerting.editor.new-recording-rule', 'New recording rule')
    : t('alerting.editor.new-alert-rule', 'New alert rule');

  const editText = isRecordingRule
    ? t('alerting.editor.edit-recording-rule', 'Edit recording rule')
    : t('alerting.editor.edit-alert-rule', 'Edit alert rule');

  return (
    <AlertingPageWrapper
      navId="alert-list"
      pageNav={{
        id: 'alert-rule-add',
        text: isExisting ? editText : newText,
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

import { type ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom-v5-compat';

import { type NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';

import { AlertWarning } from '../AlertWarning';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { DMARouteGuard } from '../components/DMARouteGuard';
import { PluginRuleRedirect } from '../components/PluginRuleRedirect';
import { AlertRuleForm } from '../components/rule-editor/alert-rule-form/AlertRuleForm';
import { useURLSearchParams } from '../hooks/useURLSearchParams';
import { getAlertRulesNavId } from '../navigation/useAlertRulesNav';
import { useRulesAccess } from '../utils/accessControlHooks';
import { prometheusAlertingPlugin } from '../utils/prometheusNavigation';
import * as ruleId from '../utils/rule-id';
import { isDataSourceManagedRuleByType, isGrafanaRuleIdentifier, isRecordingRuleByType } from '../utils/rules';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

import { ExistingRuleEditor } from './ExistingRuleEditor';
import { formValuesFromQueryParams, translateRouteParamToRuleType } from './formDefaults';
export type RuleEditorPathParams = {
  id?: string;
  type?: 'recording' | 'alerting' | 'grafana-recording';
};

export const defaultPageNav: NavModelItem = {
  id: 'alert-rule-view',
  text: '',
};

const RuleEditor = () => {
  const { identifier, type } = useRuleEditorPathParams();
  const cloneIdentifier = useIdentifierFromCopy();
  const isManualRestore = useManualRestore();
  const prefill = useDefaultsFromQuery();
  const [searchParams] = useURLSearchParams();

  const { canCreateGrafanaRules, canCreateCloudRules, canEditRules } = useRulesAccess();
  const externalIdentifier = identifier && !isGrafanaRuleIdentifier(identifier) ? identifier : undefined;
  const externalCloneIdentifier =
    cloneIdentifier && !isGrafanaRuleIdentifier(cloneIdentifier) ? cloneIdentifier : undefined;
  const isCreatingDataSourceRule = type === 'recording' || isDataSourceManagedRuleByType(prefill?.type);
  const isCreatingNewRule = !identifier && !cloneIdentifier;
  const shouldCreateInPlugin = isCreatingDataSourceRule || (isCreatingNewRule && !canCreateGrafanaRules);
  const isDataSourceManagedRoute =
    Boolean(externalIdentifier) || Boolean(externalCloneIdentifier) || shouldCreateInPlugin;
  let pluginPage: ReactNode;

  if (externalIdentifier) {
    pluginPage = <PluginRuleRedirect identifier={externalIdentifier} action="edit" />;
  } else if (externalCloneIdentifier) {
    pluginPage = <PluginRuleRedirect identifier={externalCloneIdentifier} action="clone" />;
  } else if (shouldCreateInPlugin) {
    const pluginRuleType = type === 'recording' || isRecordingRuleByType(prefill?.type) ? 'recording' : 'alerting';
    pluginPage = (
      <Navigate
        replace
        to={prometheusAlertingPlugin.newRule(pluginRuleType, {
          defaults: searchParams.get('defaults') ?? undefined,
          returnTo: searchParams.get('returnTo') ?? undefined,
        })}
      />
    );
  }

  let editorPage: ReactNode;

  if (!identifier && !canCreateGrafanaRules && !canCreateCloudRules) {
    editorPage = (
      <AlertWarning title={t('alerting.rule-editor.get-content.title-cannot-create-rules', 'Cannot create rules')}>
        <Trans i18nKey="alerting.rule-editor.get-content.sorry-allowed-create-rules">
          Sorry! You are not allowed to create rules.
        </Trans>
      </AlertWarning>
    );
  } else if (identifier && !canEditRules(identifier.ruleSourceName)) {
    editorPage = (
      <AlertWarning title={t('alerting.rule-editor.get-content.title-cannot-edit-rules', 'Cannot edit rules')}>
        <Trans i18nKey="alerting.rule-editor.get-content.sorry-allowed-rules">
          Sorry! You are not allowed to edit rules.
        </Trans>
      </AlertWarning>
    );
  } else if (identifier) {
    editorPage = (
      <ExistingRuleEditor key={JSON.stringify(identifier)} identifier={identifier} isManualRestore={isManualRestore} />
    );
  } else if (cloneIdentifier) {
    editorPage = (
      <ExistingRuleEditor
        key={JSON.stringify(identifier)}
        identifier={cloneIdentifier}
        clone={true}
        isManualRestore={isManualRestore}
      />
    );
  } else {
    editorPage = <NewRuleEditor prefill={prefill} />;
  }

  return (
    <DMARouteGuard
      isDataSourceManaged={isDataSourceManagedRoute}
      pluginPage={pluginPage}
      unavailableDescription={
        <Trans i18nKey="alerting.rule-editor.data-source-managed-unavailable-description">
          Data source-managed rules cannot be created or edited from Grafana.
        </Trans>
      }
      pageNav={defaultPageNav}
    >
      {editorPage}
    </DMARouteGuard>
  );
};

export const RECORDING_TYPE = ['grafana-recording', 'recording'];

/**
 * This one is used for creating new rules (both alerting and recording rules)
 */
function NewRuleEditor({ prefill }: { prefill: ReturnType<typeof useDefaultsFromQuery> }) {
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

  const navId = getAlertRulesNavId();

  return (
    <AlertingPageWrapper
      navId={navId}
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

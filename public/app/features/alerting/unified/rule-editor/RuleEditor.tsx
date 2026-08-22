import { useParams } from 'react-router-dom-v5-compat';

import { type NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';

import { AlertWarning } from '../AlertWarning';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { DMARouteGuard } from '../components/DMARouteGuard';
import { PluginRuleRedirect } from '../components/PluginRuleRedirect';
import { AlertRuleForm } from '../components/rule-editor/alert-rule-form/AlertRuleForm';
import { useURLSearchParams } from '../hooks/useURLSearchParams';
import { getAlertRulesNavId } from '../navigation/useAlertRulesNav';
import { type RuleFormValues } from '../types/rule-form';
import { useRulesAccess } from '../utils/accessControlHooks';
import * as ruleId from '../utils/rule-id';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

import { ExistingRuleEditor } from './ExistingRuleEditor';
import { formValuesFromQueryParams, translateRouteParamToRuleType } from './formDefaults';
import { type GrafanaEditorPage, resolveRuleEditorRouting } from './ruleEditorRouting';

export type RuleEditorPathParams = {
  id?: string;
  type?: 'recording' | 'alerting' | 'grafana-recording';
};

export const defaultPageNav: NavModelItem = {
  id: 'alert-rule-view',
  text: '',
};

const RuleEditor = () => {
  const { identifier, cloneIdentifier, type, prefill, isManualRestore } = useRuleEditorRequest();
  const access = useRulesAccess();

  const { grafanaPage, pluginHandoff } = resolveRuleEditorRouting({
    identifier,
    cloneIdentifier,
    routeType: type,
    prefillType: prefill?.type,
    access,
  });

  return (
    <DMARouteGuard
      pluginDestination={pluginHandoff && <PluginRuleRedirect {...pluginHandoff} />}
      unavailableDescription={
        <Trans i18nKey="alerting.rule-editor.data-source-managed-unavailable-description">
          Data source-managed rules cannot be created or edited from Grafana.
        </Trans>
      }
      pageNav={defaultPageNav}
    >
      <GrafanaEditorPageView page={grafanaPage} prefill={prefill} isManualRestore={isManualRestore} routeType={type} />
    </DMARouteGuard>
  );
};

interface GrafanaEditorPageViewProps {
  page: GrafanaEditorPage;
  prefill?: RuleFormValues;
  isManualRestore: boolean;
  routeType?: RuleEditorPathParams['type'];
}

function GrafanaEditorPageView({ page, prefill, isManualRestore, routeType }: GrafanaEditorPageViewProps) {
  switch (page.kind) {
    case 'refused-create':
      return (
        <AlertWarning title={t('alerting.rule-editor.get-content.title-cannot-create-rules', 'Cannot create rules')}>
          <Trans i18nKey="alerting.rule-editor.get-content.sorry-allowed-create-rules">
            Sorry! You are not allowed to create rules.
          </Trans>
        </AlertWarning>
      );
    case 'refused-edit':
      return (
        <AlertWarning title={t('alerting.rule-editor.get-content.title-cannot-edit-rules', 'Cannot edit rules')}>
          <Trans i18nKey="alerting.rule-editor.get-content.sorry-allowed-rules">
            Sorry! You are not allowed to edit rules.
          </Trans>
        </AlertWarning>
      );
    case 'edit':
      return (
        <ExistingRuleEditor
          key={JSON.stringify(page.identifier)}
          identifier={page.identifier}
          isManualRestore={isManualRestore}
        />
      );
    case 'clone':
      return (
        <ExistingRuleEditor
          key={JSON.stringify(page.identifier)}
          identifier={page.identifier}
          clone={true}
          isManualRestore={isManualRestore}
        />
      );
    case 'create':
      return <NewRuleEditor prefill={prefill} isManualRestore={isManualRestore} routeType={routeType} />;
  }
}

interface NewRuleEditorProps {
  prefill?: RuleFormValues;
  isManualRestore: boolean;
  routeType?: RuleEditorPathParams['type'];
}

/** This one is used for creating new rules (both alerting and recording rules). */
function NewRuleEditor({ prefill, isManualRestore, routeType }: NewRuleEditorProps) {
  const isRecordingRule = routeType === 'recording' || routeType === 'grafana-recording';
  const pageTitle = isRecordingRule
    ? t('alerting.editor.new-recording-rule', 'New recording rule')
    : t('alerting.editor.new-alert-rule', 'New alert rule');

  return (
    <AlertingPageWrapper
      navId={getAlertRulesNavId()}
      pageNav={{
        id: 'alert-rule-add',
        text: pageTitle,
      }}
    >
      <AlertRuleForm prefill={prefill} isManualRestore={isManualRestore} />
    </AlertingPageWrapper>
  );
}

// The pageNav property makes it difficult to only rely on AlertingPageWrapper
// to catch errors.
export default withPageErrorBoundary(RuleEditor);

function useRuleEditorRequest() {
  const params = useParams<RuleEditorPathParams>();
  const [searchParams] = useURLSearchParams();
  const { type } = params;

  return {
    type,
    identifier: ruleId.tryParse(ruleId.getRuleIdFromPathname(params), true),
    cloneIdentifier: ruleId.tryParse(searchParams.get('copyFrom') ?? undefined),
    prefill: searchParams.has('defaults')
      ? formValuesFromQueryParams(searchParams.get('defaults') ?? '', translateRouteParamToRuleType(type))
      : undefined,
    isManualRestore: searchParams.has('isManualRestore'),
  };
}

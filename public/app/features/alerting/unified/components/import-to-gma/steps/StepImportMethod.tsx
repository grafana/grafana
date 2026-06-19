import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { OrgRole, type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Field, RadioButtonGroup, Select, Stack, Text } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { useAutoSyncConfiguration } from '../../settings/useAutoSyncConfiguration';
import { type ImportFormValues } from '../ImportToGMA';
import { WizardStep } from '../Wizard/WizardStep';
import { type ImportMethod, StepKey } from '../Wizard/types';

import { MethodPanelCard } from './MethodPanelCard';

/**
 * Whether the Auto-sync method may be offered: gated by the external-alertmanager-sync
 * feature toggle and Org Admin (the admin_config endpoint requires org admin).
 */
export function isAutoSyncSegmentEnabled(): boolean {
  return Boolean(config.featureToggles['alerting.syncExternalAlertmanager']) && contextSrv.hasRole(OrgRole.Admin);
}

function getMethodOptions(includeAutoSync: boolean): Array<SelectableValue<ImportMethod>> {
  const options: Array<SelectableValue<ImportMethod>> = [];
  if (includeAutoSync) {
    options.push({ value: 'autosync', label: t('alerting.import-to-gma.method.autosync', 'Auto-sync') });
  }
  options.push(
    { value: 'stage', label: t('alerting.import-to-gma.method.stage', 'Stage') },
    { value: 'promote', label: t('alerting.import-to-gma.method.promote', 'Promote') }
  );
  return options;
}

interface StepImportMethodProps {
  onNext: () => boolean;
  onCancel: () => void;
}

/**
 * First wizard step: choose how external Alertmanager config is brought into Grafana.
 * Stage and Promote continue into the full import flow; Auto-sync collapses the wizard
 * to a single confirmation step.
 */
export function StepImportMethod({ onNext, onCancel }: StepImportMethodProps) {
  const { control, watch } = useFormContext<ImportFormValues>();
  const method = watch('importMethod');
  const autosyncDatasourceUID = watch('autosyncDatasourceUID');
  const includeAutoSync = isAutoSyncSegmentEnabled();
  const options = useMemo(() => getMethodOptions(includeAutoSync), [includeAutoSync]);

  // For autosync the user must pick a data source before proceeding; the panel only lets a
  // source be selected when one can actually be synced (see AutoSyncMethodPanel). Stage/Promote
  // can always proceed.
  const disableNext = method === 'autosync' ? !autosyncDatasourceUID : false;

  return (
    <WizardStep
      stepId={StepKey.Method}
      label={t('alerting.import-to-gma.method.heading', 'How do you want to add these resources?')}
      subHeader={
        <Trans i18nKey="alerting.import-to-gma.method.subtitle">
          Choose how alert configuration from your external Alertmanager is brought into Grafana. You can change this
          before you finish.
        </Trans>
      }
      onNext={onNext}
      onCancel={onCancel}
      disableNext={disableNext}
    >
      <Stack direction="column" gap={2}>
        <Controller
          name="importMethod"
          control={control}
          render={({ field: { value, onChange } }) => (
            <RadioButtonGroup options={options} value={value} onChange={onChange} />
          )}
        />
        {method === 'stage' && <StagePanel />}
        {method === 'promote' && <PromotePanel />}
        {method === 'autosync' && <AutoSyncMethodPanel />}
      </Stack>
    </WizardStep>
  );
}

/** Info note shown for the one-time import methods describing the steps that follow. */
function NextStepsNote() {
  return (
    <Alert
      severity="info"
      title={t(
        'alerting.import-to-gma.method.next-steps',
        "Next you'll set up notification resources and alert rules, then review & import."
      )}
    />
  );
}

function StagePanel() {
  return (
    <MethodPanelCard title={t('alerting.import-to-gma.method.stage-title', 'Stage')}>
      <Text color="secondary">
        <Trans i18nKey="alerting.import-to-gma.method.stage-desc">
          Stage brings the config in safely without touching your live setup. Resources stay visible but read-only so
          you can review them first. Promote when you are ready to use them as editable Grafana resources.
        </Trans>
      </Text>
      <NextStepsNote />
    </MethodPanelCard>
  );
}

function PromotePanel() {
  return (
    <MethodPanelCard title={t('alerting.import-to-gma.method.promote-title', 'Promote')}>
      <Text color="secondary">
        <Trans i18nKey="alerting.import-to-gma.method.promote-desc">
          Promote when you are ready to use these resources. Each contact point, policy, template, and mute timing
          merges into your live config and becomes a normal, editable Grafana resource.
        </Trans>
      </Text>
      <Alert
        severity="warning"
        title={t('alerting.import-to-gma.method.promote-warning-title', "Promoting can't be undone")}
      >
        <Trans i18nKey="alerting.import-to-gma.method.promote-warning-desc">
          The imported resources merge into your live notification config. To reverse it later you would have to delete
          each resulting resource by hand.
        </Trans>
      </Alert>
      <NextStepsNote />
    </MethodPanelCard>
  );
}

/**
 * Auto-sync method panel. Mounted only when the Auto-sync segment is selected so its
 * queries (which require org admin) don't run for Stage/Promote imports. The picked source
 * is written straight to the form, which is the single source of truth for the wizard's
 * "can proceed" gating. Reuses the Settings auto-sync hook for the data-source list and state.
 */
function AutoSyncMethodPanel() {
  const { control } = useFormContext<ImportFormValues>();
  const { state, mimirCortexDatasources, isLoading } = useAutoSyncConfiguration();

  const options = useMemo<Array<SelectableValue<string>>>(
    () => mimirCortexDatasources.map((ds) => ({ value: ds.uid, label: ds.name, imgUrl: ds.typeLogoUrl })),
    [mimirCortexDatasources]
  );

  const title = t('alerting.import-to-gma.method.autosync-title', 'Auto-sync');

  // Note: the "auto-sync already active" case is handled at the page level (ImportToGMA blocks
  // the whole wizard), so it never reaches this panel.

  if (state.kind === 'no-datasources') {
    return (
      <MethodPanelCard title={title}>
        <Alert
          severity="info"
          title={t('alerting.import-to-gma.method.autosync-no-datasources-title', 'No Mimir or Cortex data sources')}
        >
          <Trans i18nKey="alerting.import-to-gma.method.autosync-no-datasources-desc">
            Auto-sync needs a Mimir or Cortex Alertmanager data source. Add one, then start this wizard again.
          </Trans>
        </Alert>
      </MethodPanelCard>
    );
  }

  return (
    <MethodPanelCard title={title}>
      <Text color="secondary">
        <Trans i18nKey="alerting.import-to-gma.method.autosync-desc">
          Grafana continuously syncs alert configuration from a Mimir or Cortex Alertmanager data source. The synced
          resources stay read-only and managed by the source.
        </Trans>
      </Text>
      <Field noMargin label={t('alerting.import-to-gma.method.autosync-datasource-label', 'Data source')}>
        <Controller
          name="autosyncDatasourceUID"
          control={control}
          render={({ field: { value, onChange } }) => (
            <Select
              inputId="autosync-datasource-picker"
              options={options}
              value={value || null}
              isLoading={isLoading}
              width={50}
              placeholder={t('alerting.import-to-gma.method.autosync-datasource-placeholder', 'Select a data source…')}
              onChange={(option) => onChange(option?.value ?? '')}
            />
          )}
        />
      </Field>
    </MethodPanelCard>
  );
}

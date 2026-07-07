import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Card, ConfirmModal, Field, LinkButton, Select, Stack, Tooltip, useStyles2 } from '@grafana/ui';

import { AutoSyncStatusBadge } from './AutoSyncStatusBadge';
import { hasConfiguredUid, isOperatorManaged, useAutoSyncConfiguration } from './useAutoSyncConfiguration';

export function AutoSyncConfiguration() {
  const styles = useStyles2(getStyles);
  const { state, mimirCortexDatasources, selectedUid, setSelectedUid, save, disableSync, isPending, isLoading } =
    useAutoSyncConfiguration();

  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  const options = useMemo<Array<SelectableValue<string>>>(
    () =>
      mimirCortexDatasources.map((ds) => ({
        value: ds.uid,
        label: ds.name,
        imgUrl: ds.typeLogoUrl,
      })),
    [mimirCortexDatasources]
  );

  const operatorManaged = isOperatorManaged(state);
  const showDisableSync = state.kind === 'configured' || state.kind === 'orphan-uid';
  const showSave = state.kind === 'unconfigured' || state.kind === 'orphan-uid';
  const savedUid = hasConfiguredUid(state) ? state.uid : '';
  const saveDisabled = !selectedUid || selectedUid === savedUid;
  const saveDisabledTooltip = t(
    'alerting.settings.auto-sync.save-disabled-no-selection',
    'Select a Mimir or Cortex Alertmanager datasource to enable saving.'
  );

  const handleDisableConfirm = async () => {
    setShowDisableConfirm(false);
    await disableSync();
  };

  return (
    <Card
      noMargin
      className={styles.cardSpacing}
      role="region"
      aria-label={t('alerting.settings.auto-sync.title', 'Auto-sync configuration')}
    >
      <Card.Heading>
        <Stack alignItems="center" gap={1}>
          <Trans i18nKey="alerting.settings.auto-sync.title">Auto-sync configuration</Trans>
          <AutoSyncStatusBadge state={state} />
        </Stack>
      </Card.Heading>
      <Card.Description>
        <Trans i18nKey="alerting.settings.auto-sync.description">
          Continuously sync alert configuration from a Mimir or Cortex Alertmanager datasource into Grafana.
        </Trans>
      </Card.Description>
      <Card.Meta>
        <div className={styles.formColumn}>
          {state.kind === 'orphan-uid' && (
            <Alert
              severity="warning"
              title={t('alerting.settings.auto-sync.orphan-warning-title', 'Configured datasource not found')}
            >
              <Trans i18nKey="alerting.settings.auto-sync.orphan-warning" values={{ uid: state.uid }}>
                The configured datasource UID {'{{uid}}'} is not available. Disable sync or restore the datasource to
                continue.
              </Trans>
            </Alert>
          )}
          {operatorManaged && (
            <Alert
              severity="info"
              title={t('alerting.settings.auto-sync.operator-managed-title', 'Managed by operator')}
            >
              <Trans i18nKey="alerting.settings.auto-sync.operator-managed-info">
                This value is set by the <code>[unified_alerting] external_alertmanager_uid</code> key in grafana.ini
                and cannot be changed from the UI. Edit the configuration file and restart Grafana, or remove the key to
                manage sync from here.
              </Trans>
            </Alert>
          )}
          <div className={styles.formRow}>
            <Field
              noMargin
              label={t('alerting.settings.auto-sync.picker-label', 'Datasource')}
              className={styles.field}
              htmlFor="auto-sync-datasource-picker"
            >
              {state.kind === 'no-datasources' ? (
                <div className={styles.noDatasourcesRow}>
                  <span className={styles.muted}>
                    <Trans i18nKey="alerting.settings.auto-sync.picker-empty">
                      No Mimir or Cortex datasources available
                    </Trans>
                  </span>
                  <LinkButton
                    href="/connections/datasources/alertmanager"
                    icon="plus"
                    variant="secondary"
                    fill="outline"
                  >
                    <Trans i18nKey="alerting.settings.auto-sync.add-datasource-link">Add Mimir datasource</Trans>
                  </LinkButton>
                </div>
              ) : (
                <Select
                  inputId="auto-sync-datasource-picker"
                  aria-label={t('alerting.settings.auto-sync.picker-label', 'Datasource')}
                  options={options}
                  value={selectedUid || null}
                  onChange={(option) => option?.value && setSelectedUid(option.value)}
                  disabled={operatorManaged || isLoading}
                  isLoading={isLoading}
                  width={50}
                  placeholder={t(
                    'alerting.settings.auto-sync.picker-placeholder',
                    'Select a Mimir or Cortex Alertmanager datasource…'
                  )}
                  noOptionsMessage={t(
                    'alerting.settings.auto-sync.picker-empty',
                    'No Mimir or Cortex datasources available'
                  )}
                />
              )}
            </Field>
            {state.kind !== 'no-datasources' && (
              <Stack direction="row" gap={1} alignItems="flex-end">
                {showDisableSync && (
                  <Button
                    variant="destructive"
                    fill="outline"
                    onClick={() => setShowDisableConfirm(true)}
                    disabled={isPending}
                    icon="times"
                  >
                    <Trans i18nKey="alerting.settings.auto-sync.action-disable">Disable sync</Trans>
                  </Button>
                )}
                {showSave && (
                  <Tooltip content={saveDisabled ? saveDisabledTooltip : ''} show={saveDisabled ? undefined : false}>
                    <span className={styles.tooltipTarget}>
                      <Button variant="primary" onClick={() => save()} disabled={saveDisabled || isPending}>
                        <Trans i18nKey="common.save">Save</Trans>
                      </Button>
                    </span>
                  </Tooltip>
                )}
              </Stack>
            )}
          </div>
        </div>
      </Card.Meta>
      <ConfirmModal
        isOpen={showDisableConfirm}
        title={t('alerting.settings.auto-sync.disable-confirm-title', 'Disable Mimir Alertmanager auto-sync?')}
        body={
          hasConfiguredUid(state)
            ? t(
                'alerting.settings.auto-sync.disable-confirm-body',
                'Disabling will stop continuous sync from datasource {{uid}}. You can re-enable it later by selecting a datasource again.',
                { uid: state.uid }
              )
            : t(
                'alerting.settings.auto-sync.disable-confirm-body-generic',
                'Disabling will stop continuous sync. You can re-enable it later by selecting a datasource again.'
              )
        }
        confirmText={t('alerting.settings.auto-sync.disable-confirm-action', 'Disable sync')}
        onConfirm={handleDisableConfirm}
        onDismiss={() => setShowDisableConfirm(false)}
      />
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  cardSpacing: css({
    '& > * + *': {
      marginTop: theme.spacing(2),
    },
  }),
  formColumn: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    width: '100%',
  }),
  formRow: css({
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'flex-end',
    width: '100%',
  }),
  field: css({
    marginBottom: 0,
  }),
  noDatasourcesRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1, 0),
    width: '100%',
  }),
  muted: css({
    color: theme.colors.text.secondary,
  }),
  tooltipTarget: css({
    display: 'inline-flex',
  }),
});

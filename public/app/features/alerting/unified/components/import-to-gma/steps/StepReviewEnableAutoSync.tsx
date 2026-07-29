import { useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Badge, Box, Button, Stack, Text, Tooltip } from '@grafana/ui';

import { trackImportToGMAError, trackImportToGMASuccess } from '../../../Analytics';
import { alertListPageLink } from '../../../utils/navigation';
import { useAutoSyncConfiguration } from '../../settings/useAutoSyncConfiguration';
import { type ImportFormValues } from '../ImportToGMA';
import { CancelButton } from '../Wizard/CancelButton';
import { useStepperState } from '../Wizard/StepperState';
import { StepKey } from '../Wizard/types';

import { MethodPanelCard } from './MethodPanelCard';

interface StepReviewEnableAutoSyncProps {
  onCancel: () => void;
}

/**
 * Auto-sync confirmation step. Replaces the import + review steps: enabling here drives the same
 * Settings state as the Alerting → Settings page, then — like a successful import — navigates to
 * the alert rules list. The shared hook shows the success toast (which persists across navigation).
 */
export function StepReviewEnableAutoSync({ onCancel }: StepReviewEnableAutoSyncProps) {
  const { watch } = useFormContext<ImportFormValues>();
  const { setActiveStep } = useStepperState();
  const { save, isPending, isReady, mimirCortexDatasources } = useAutoSyncConfiguration();

  const selectedUid = watch('autosyncDatasourceUID') ?? '';
  const dataSourceName = mimirCortexDatasources.find((ds) => ds.uid === selectedUid)?.name ?? selectedUid;
  const notReadyTooltip = t(
    'alerting.import-to-gma.autosync-review.enable-not-ready',
    'Grafana is still setting up auto-sync for this organization. Try again in a moment.'
  );

  const handleEnable = async () => {
    const enabled = await save(selectedUid);
    if (enabled) {
      trackImportToGMASuccess({ importMethod: 'autosync' });
      // No list filters are applied for auto-sync.
      locationService.push(alertListPageLink({}, { skipSubPath: true }));
    } else {
      trackImportToGMAError({ importMethod: 'autosync' });
    }
  };

  return (
    <Stack direction="column" gap={3}>
      <Box>
        <Text variant="h4" element="h2">
          {t('alerting.import-to-gma.autosync-review.heading', 'Review & enable auto-sync')}
        </Text>
        <Text color="secondary">
          <Trans i18nKey="alerting.import-to-gma.autosync-review.subtitle">
            Confirm the source. Once enabled, Grafana keeps these resources in sync until you turn it off in Alerting
            settings.
          </Trans>
        </Text>
      </Box>

      <MethodPanelCard
        title={t('alerting.import-to-gma.autosync-review.card-title', 'Auto-sync')}
        headerActions={
          <Badge
            color="green"
            icon="sync"
            text={t('alerting.import-to-gma.autosync-review.badge', 'Will sync continuously')}
          />
        }
      >
        <SummaryRow label={t('alerting.import-to-gma.autosync-review.source', 'Source')} value={dataSourceName} />
        <SummaryRow
          label={t('alerting.import-to-gma.autosync-review.scope', 'Scope')}
          value={t(
            'alerting.import-to-gma.autosync-review.scope-value',
            'Contact points, notification policies, templates, mute timings, and alert rules'
          )}
        />
      </MethodPanelCard>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" gap={1}>
          <Button variant="secondary" icon="arrow-left" onClick={() => setActiveStep(StepKey.Method)}>
            {t('alerting.import-to-gma.autosync-review.back', 'Add method')}
          </Button>
          {/* Gate on isReady, not on loading: selectedUid comes from the form so it is already set on
              mount, and save() cannot write until the worker has seeded the Config singleton. Without
              this the button is clickable while that read is in flight — or indefinitely when it
              resolved to nothing — and the click reports a false "still initializing" failure. */}
          <Tooltip content={notReadyTooltip} show={isReady ? false : undefined}>
            <Box display="inline-block">
              <Button
                variant="primary"
                icon="sync"
                disabled={!selectedUid || isPending || !isReady}
                onClick={handleEnable}
              >
                {t('alerting.import-to-gma.autosync-review.enable', 'Enable auto-sync')}
              </Button>
            </Box>
          </Tooltip>
        </Stack>
        <CancelButton onCancel={onCancel} />
      </Stack>
    </Stack>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" gap={2} justifyContent="space-between">
      <Text color="secondary">{label}</Text>
      <Text>{value}</Text>
    </Stack>
  );
}

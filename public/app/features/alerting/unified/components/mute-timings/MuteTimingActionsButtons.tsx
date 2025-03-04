import { useState } from 'react';

import { Badge, ConfirmModal, LinkButton, Stack } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { useExportMuteTimingsDrawer } from 'app/features/alerting/unified/components/mute-timings/useExportMuteTimingsDrawer';

import { Authorize } from '../../components/Authorize';
import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { isLoading } from '../../hooks/useAsync';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { makeAMLink } from '../../utils/misc';
import { isDisabled } from '../../utils/mute-timings';

import { MuteTiming, useDeleteMuteTiming } from './useMuteTimings';

interface MuteTimingActionsButtonsProps {
  muteTiming: MuteTiming;
  alertManagerSourceName: string;
}

export const MuteTimingActionsButtons = ({ muteTiming, alertManagerSourceName }: MuteTimingActionsButtonsProps) => {
  const [deleteMuteTiming, deleteMuteTimingRequestState] = useDeleteMuteTiming({
    alertmanager: alertManagerSourceName!,
  });
  const [showDeleteDrawer, setShowDeleteDrawer] = useState(false);
  const [ExportDrawer, showExportDrawer] = useExportMuteTimingsDrawer();
  const [exportSupported, exportAllowed] = useAlertmanagerAbility(AlertmanagerAction.ExportMuteTimings);

  const closeDeleteModal = () => setShowDeleteDrawer(false);

  const isGrafanaDataSource = alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME;
  const viewOrEditHref = makeAMLink(`/alerting/routes/mute-timing/edit`, alertManagerSourceName, {
    muteName: muteTiming.id,
  });

  const viewOrEditButton = (
    <LinkButton
      href={viewOrEditHref}
      variant="secondary"
      size="sm"
      icon={muteTiming.provisioned ? 'eye' : 'pen'}
      disabled={isLoading(deleteMuteTimingRequestState)}
    >
      {muteTiming.provisioned ? (
        <Trans i18nKey="alerting.common.view">View</Trans>
      ) : (
        <Trans i18nKey="alerting.common.edit">Edit</Trans>
      )}
    </LinkButton>
  );

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="flex-end" wrap="wrap">
        {!isGrafanaDataSource && isDisabled(muteTiming) && (
          <Badge text={t('alerting.mute-timing-actions-buttons.text-disabled', 'Disabled')} color="orange" />
        )}
        <Authorize actions={[AlertmanagerAction.UpdateMuteTiming]}>{viewOrEditButton}</Authorize>

        {exportSupported && (
          <LinkButton
            icon="download-alt"
            variant="secondary"
            size="sm"
            data-testid="export"
            disabled={!exportAllowed || isLoading(deleteMuteTimingRequestState)}
            onClick={() => showExportDrawer(muteTiming.name)}
          >
            <Trans i18nKey="alerting.common.export">Export</Trans>
          </LinkButton>
        )}

        {!muteTiming.provisioned && (
          <Authorize actions={[AlertmanagerAction.DeleteMuteTiming]}>
            <LinkButton
              icon="trash-alt"
              variant="secondary"
              size="sm"
              onClick={() => setShowDeleteDrawer(true)}
              disabled={isLoading(deleteMuteTimingRequestState)}
            >
              <Trans i18nKey="alerting.common.delete">Delete</Trans>
            </LinkButton>
          </Authorize>
        )}
      </Stack>
      <ConfirmModal
        isOpen={showDeleteDrawer}
        title={t('alerting.mute-timing-actions-buttons.title-delete-mute-timing', 'Delete mute timing')}
        body={`Are you sure you would like to delete "${muteTiming.name}"?`}
        confirmText={t('alerting.common.delete', 'Delete')}
        onConfirm={async () => {
          await deleteMuteTiming.execute({
            name: muteTiming?.metadata?.name ?? muteTiming.name,
          });

          closeDeleteModal();
        }}
        onDismiss={closeDeleteModal}
      />
      {ExportDrawer}
    </>
  );
};

import { useState } from 'react';

import { Badge, ConfirmModal, LinkButton, Stack } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { useExportMuteTimingsDrawer } from 'app/features/alerting/unified/components/mute-timings/useExportMuteTimingsDrawer';
import { MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';

import { Authorize } from '../../components/Authorize';
import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { makeAMLink } from '../../utils/misc';
import { isDisabled } from '../../utils/mute-timings';

import { useDeleteMuteTiming } from './useMuteTimings';

interface MuteTimingActionsButtonsProps {
  muteTiming: MuteTimeInterval;
  alertManagerSourceName: string;
}

export const MuteTimingActionsButtons = ({ muteTiming, alertManagerSourceName }: MuteTimingActionsButtonsProps) => {
  const deleteMuteTiming = useDeleteMuteTiming({ alertmanager: alertManagerSourceName! });
  const [showDeleteDrawer, setShowDeleteDrawer] = useState(false);
  const [ExportDrawer, showExportDrawer] = useExportMuteTimingsDrawer();
  const [exportSupported, exportAllowed] = useAlertmanagerAbility(AlertmanagerAction.ExportMuteTimings);

  const isGrafanaDataSource = alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME;
  const viewOrEditHref = makeAMLink(`/alerting/routes/mute-timing/edit`, alertManagerSourceName, {
    muteName: muteTiming?.metadata?.name || muteTiming.name,
  });

  const viewOrEditButton = (
    <LinkButton href={viewOrEditHref} variant="secondary" size="sm" icon={muteTiming.provisioned ? 'eye' : 'pen'}>
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
        {!isGrafanaDataSource && isDisabled(muteTiming) && <Badge text="Disabled" color="orange" />}
        <Authorize actions={[AlertmanagerAction.UpdateMuteTiming]}>{viewOrEditButton}</Authorize>

        {!muteTiming.provisioned && (
          <Authorize actions={[AlertmanagerAction.DeleteMuteTiming]}>
            <LinkButton icon="trash-alt" variant="secondary" size="sm" onClick={() => setShowDeleteDrawer(true)}>
              <Trans i18nKey="alerting.common.delete">Delete</Trans>
            </LinkButton>
          </Authorize>
        )}

        {exportSupported && (
          <LinkButton
            icon="download-alt"
            variant="secondary"
            size="sm"
            data-testid="export"
            disabled={!exportAllowed}
            onClick={() => showExportDrawer(muteTiming.name)}
          >
            <Trans i18nKey="alerting.common.export">Export</Trans>
          </LinkButton>
        )}
      </Stack>
      <ConfirmModal
        isOpen={showDeleteDrawer}
        title="Delete mute timing"
        body={`Are you sure you would like to delete "${muteTiming.name}"?`}
        confirmText={t('alerting.common.delete', 'Delete')}
        onConfirm={async () => {
          await deleteMuteTiming({
            name: muteTiming?.metadata?.name || muteTiming.name,
          });

          setShowDeleteDrawer(false);
        }}
        onDismiss={() => setShowDeleteDrawer(false)}
      />
      {ExportDrawer}
    </>
  );
};

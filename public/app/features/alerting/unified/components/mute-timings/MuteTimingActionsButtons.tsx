import { useContext } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Badge, LinkButton, ModalsContext, Stack } from '@grafana/ui';
import { useExportMuteTimingsDrawer } from 'app/features/alerting/unified/components/mute-timings/useExportMuteTimingsDrawer';

import { isGranted, isProvisioned, isSupported } from '../../hooks/abilities/abilityUtils';
import { useTimeIntervalAbility } from '../../hooks/abilities/alertmanager/useTimeIntervalAbility';
import { TimeIntervalAction } from '../../hooks/abilities/types';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { makeAMLink } from '../../utils/misc';
import { isDisabled } from '../../utils/mute-timings';

import { DeleteMuteTimingModal } from './DeleteMuteTimingModal';
import { type MuteTiming } from './useMuteTimings';

interface MuteTimingActionsButtonsProps {
  muteTiming: MuteTiming;
  alertManagerSourceName: string;
}

export const MuteTimingActionsButtons = ({ muteTiming, alertManagerSourceName }: MuteTimingActionsButtonsProps) => {
  const { showModal, hideModal } = useContext(ModalsContext);
  const [ExportDrawer, showExportDrawer] = useExportMuteTimingsDrawer();

  const showDeleteModal = () =>
    showModal(DeleteMuteTimingModal, { muteTiming, alertManagerSourceName, onDismiss: hideModal });
  const updateAbility = useTimeIntervalAbility({ action: TimeIntervalAction.Update, context: muteTiming });
  const deleteAbility = useTimeIntervalAbility({ action: TimeIntervalAction.Delete, context: muteTiming });
  const exportAbility = useTimeIntervalAbility({ action: TimeIntervalAction.Export });

  const isGrafanaDataSource = alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME;
  const viewOrEditHref = makeAMLink(`/alerting/routes/mute-timing/edit`, alertManagerSourceName, {
    muteName: muteTiming.id,
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
        {!isGrafanaDataSource && isDisabled(muteTiming) && (
          <Badge text={t('alerting.mute-timing-actions-buttons.text-disabled', 'Disabled')} color="orange" />
        )}
        {(isGranted(updateAbility) || isProvisioned(updateAbility)) && viewOrEditButton}

        {isSupported(exportAbility) && (
          <LinkButton
            icon="download-alt"
            variant="secondary"
            size="sm"
            data-testid="export"
            disabled={!isGranted(exportAbility)}
            onClick={() => showExportDrawer(muteTiming.name)}
          >
            <Trans i18nKey="alerting.common.export">Export</Trans>
          </LinkButton>
        )}

        {!muteTiming.provisioned && isGranted(deleteAbility) && (
          <LinkButton icon="trash-alt" variant="secondary" size="sm" onClick={showDeleteModal}>
            <Trans i18nKey="alerting.common.delete">Delete</Trans>
          </LinkButton>
        )}
      </Stack>
      {ExportDrawer}
    </>
  );
};

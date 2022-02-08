import React, { FC, useState } from 'react';
import { Spinner, Tooltip, useStyles } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { AppEvents } from '@grafana/data';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { appEvents } from 'app/core/core';
import { getStyles } from './AlertsActions.styles';
import { AlertsActionsProps } from './AlertsActions.types';
import { AlertStatus } from '../Alerts.types';
import { AlertsService } from '../Alerts.service';
import { Messages } from './AlertsActions.messages';
import { Bell, BellBarred } from './icons';
import { TOGGLE_ALERT_CANCEL_TOKEN } from './AlertsActions.constants';

export const AlertsActions: FC<AlertsActionsProps> = ({ alert, getAlerts }) => {
  const styles = useStyles(getStyles);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [generateToken] = useCancelToken();

  const isSilenced = alert.status === AlertStatus.SILENCED;
  const ToggleIcon = isSilenced ? Bell : BellBarred;
  const title = isSilenced ? Messages.activateTitle : Messages.silenceTitle;

  const toggleAlert = async () => {
    setPendingRequest(true);
    try {
      await AlertsService.toggle(
        {
          alert_ids: [alert.alertId],
          silenced: isSilenced ? 'FALSE' : 'TRUE',
        },
        generateToken(TOGGLE_ALERT_CANCEL_TOKEN)
      );
      appEvents.emit(AppEvents.alertSuccess, [isSilenced ? Messages.activateSuccess : Messages.silenceSuccess]);
      getAlerts();
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setPendingRequest(false);
  };

  return (
    <div className={styles.actionsWrapper}>
      {pendingRequest ? (
        <Spinner />
      ) : (
        <Tooltip placement="top" content={title}>
          <button data-testid="silence-alert-button" onClick={toggleAlert} className={styles.button} title={title}>
            <ToggleIcon />
          </button>
        </Tooltip>
      )}
    </div>
  );
};

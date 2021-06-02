import React, { FC, useState } from 'react';
import { Spinner, useStyles } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/core';
import { getStyles } from './AlertsActions.styles';
import { AlertsActionsProps } from './AlertsActions.types';
import { AlertStatus } from '../Alerts.types';
import { AlertsService } from '../Alerts.service';
import { Messages } from './AlertsActions.messages';
import { Bell, BellBarred } from './icons';

export const AlertsActions: FC<AlertsActionsProps> = ({ alert, getAlerts }) => {
  const styles = useStyles(getStyles);
  const [pendingRequest, setPendingRequest] = useState(false);

  const isSilenced = alert.status === AlertStatus.SILENCED;
  const ToggleIcon = isSilenced ? Bell : BellBarred;
  const title = isSilenced ? Messages.activateTitle : Messages.silenceTitle;

  const toggleAlert = async () => {
    setPendingRequest(true);
    try {
      await AlertsService.toggle({
        alert_id: alert.alertId,
        silenced: isSilenced ? 'FALSE' : 'TRUE',
      });
      appEvents.emit(AppEvents.alertSuccess, [isSilenced ? Messages.activateSuccess : Messages.silenceSuccess]);
      getAlerts();
    } catch (e) {
      logger.error(e);
    } finally {
      setPendingRequest(false);
    }
  };

  return (
    <div className={styles.actionsWrapper}>
      {pendingRequest ? (
        <Spinner />
      ) : (
        <button data-qa="silence-alert-button" onClick={toggleAlert} className={styles.button} title={title}>
          <ToggleIcon />
        </button>
      )}
    </div>
  );
};

import { LoaderButton } from '@percona/platform-core';
import React, { FC, useState } from 'react';

import { AlertsReloadContext } from 'app/percona/check/Check.context';
import { CheckService } from 'app/percona/check/Check.service';
import { Labels } from 'app/percona/check/types';

import { makeSilencePayload } from './SilenceAlertButton.utils';

interface SilenceAlertButtonProps {
  labels: Labels;
}

export const SilenceAlertButton: FC<SilenceAlertButtonProps> = ({ labels }) => {
  const alertsReloadContext = React.useContext(AlertsReloadContext);
  const [isRequestPending, setRequestPending] = useState(false);

  const handleClick = async () => {
    const silencePayload = makeSilencePayload(labels);

    setRequestPending(true);
    try {
      await CheckService.silenceAlert(silencePayload);
      await alertsReloadContext.fetchAlerts();
    } catch (e) {
      console.error(e);
    } finally {
      setRequestPending(false);
    }
  };

  return (
    <LoaderButton type="button" size="sm" variant="secondary" loading={isRequestPending} onClick={handleClick}>
      Silence
    </LoaderButton>
  );
};

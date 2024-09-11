import { useCallback, useMemo, useState } from 'react';
import { useToggle } from 'react-use';

import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { GrafanaReceiverExporter } from '../export/GrafanaReceiverExporter';
import { GrafanaReceiversExporter } from '../export/GrafanaReceiversExporter';

export const ALL_CONTACT_POINTS = Symbol('all contact points');

type ExportProps = [JSX.Element | null, (receiver: string | typeof ALL_CONTACT_POINTS) => void];

export const useExportContactPoint = (): ExportProps => {
  const [receiverName, setReceiverName] = useState<string | typeof ALL_CONTACT_POINTS | null>(null);
  const [isExportDrawerOpen, toggleShowExportDrawer] = useToggle(false);
  const [decryptSecretsSupported, decryptSecretsAllowed] = useAlertmanagerAbility(AlertmanagerAction.DecryptSecrets);

  const canReadSecrets = decryptSecretsSupported && decryptSecretsAllowed;

  const handleClose = useCallback(() => {
    setReceiverName(null);
    toggleShowExportDrawer(false);
  }, [toggleShowExportDrawer]);

  const handleOpen = (receiverName: string | typeof ALL_CONTACT_POINTS) => {
    setReceiverName(receiverName);
    toggleShowExportDrawer(true);
  };

  const drawer = useMemo(() => {
    if (!receiverName || !isExportDrawerOpen) {
      return null;
    }

    if (receiverName === ALL_CONTACT_POINTS) {
      // use this drawer when we want to export all contact points
      return <GrafanaReceiversExporter decrypt={canReadSecrets} onClose={handleClose} />;
    } else {
      // use this one for exporting a single contact point
      return <GrafanaReceiverExporter receiverName={receiverName} decrypt={canReadSecrets} onClose={handleClose} />;
    }
  }, [canReadSecrets, isExportDrawerOpen, handleClose, receiverName]);

  return [drawer, handleOpen];
};

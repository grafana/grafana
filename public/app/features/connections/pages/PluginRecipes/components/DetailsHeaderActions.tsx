import React from 'react';

import { Button } from '@grafana/ui';

export type Props = {
  // Can be called to start or continue the install
  onInstall: () => void;

  // Tells if the whole recipe is installed
  isInstalled: boolean;

  // Tells if the install has been actually started in the backend as well
  isInstallInProgress: boolean;

  // Tells if the install has been initiated by the user (but maybe haven't been updated in the DTO status yet)
  isInstallStarted: boolean;
};

export const DetailsHeaderActions = ({ onInstall, isInstalled, isInstallInProgress, isInstallStarted }: Props) => {
  if (isInstallInProgress || isInstallStarted) {
    return (
      <>
        <Button icon="check" onClick={onInstall} disabled>
          Installing...
        </Button>
      </>
    );
  }

  if (isInstalled) {
    return (
      <>
        <Button icon="plus" onClick={onInstall} variant="destructive">
          Uninstall
        </Button>
      </>
    );
  }

  return (
    <>
      <Button icon="plus" onClick={onInstall}>
        Install
      </Button>
    </>
  );
};

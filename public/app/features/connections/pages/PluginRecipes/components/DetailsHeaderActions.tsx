import React from 'react';

import { Button } from '@grafana/ui';

export type Props = {
  // Can be called to start or continue the install
  onInstall: () => void;

  // Tells if the whole recipe is installed
  isInstalled: boolean;

  // Tells if the install is in progress
  isInstallInProgress: boolean;
};

export const DetailsHeaderActions = ({ onInstall, isInstalled, isInstallInProgress }: Props) => {
  if (isInstalled) {
    return (
      <>
        <Button onClick={onInstall} variant="destructive">
          Uninstall
        </Button>
      </>
    );
  }

  if (isInstallInProgress) {
    return (
      <>
        <Button icon="check" onClick={onInstall} disabled>
          Installing...
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

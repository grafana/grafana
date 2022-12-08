import React from 'react';

import { Button } from '@grafana/ui';

export type Props = {
  onInstall: () => void;
  isInstalled: boolean;
  isInstallInProgress: boolean;
};

export const DetailsHeaderActions = ({ onInstall, isInstalled, isInstallInProgress }: Props) => {
  if (isInstallInProgress) {
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

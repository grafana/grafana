import React from 'react';

import { Button } from '@grafana/ui';

export type Props = {
  onInstall: () => void;
};

export const DetailsHeaderActions = ({ onInstall }: Props) => {
  return (
    <>
      <Button icon="plus" onClick={onInstall}>
        Install
      </Button>
    </>
  );
};

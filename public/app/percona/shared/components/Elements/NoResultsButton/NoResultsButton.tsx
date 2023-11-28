import React, { FC } from 'react';

import { Button } from '@grafana/ui';

import { NoResultsButtonProps } from './NoResultsButton.types';

export const NoResultsButton: FC<React.PropsWithChildren<NoResultsButtonProps>> = ({ buttonMessage, emptyMessage, onClick = () => null }) => {
  return (
    <div>
      {emptyMessage}
      <Button onClick={onClick} size="lg">
        {buttonMessage}
      </Button>
    </div>
  );
};

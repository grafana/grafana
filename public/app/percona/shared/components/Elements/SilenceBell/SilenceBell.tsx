import React, { FC, useState, useCallback } from 'react';

import { IconButton, Spinner } from '@grafana/ui';

import { SilenceBellProps } from './SilenceBell.types';

export const SilenceBell: FC<React.PropsWithChildren<SilenceBellProps>> = ({ silenced, tooltip = '', onClick = () => null }) => {
  const [loading, setLoading] = useState(false);
  const handleClick = useCallback(async () => {
    setLoading(true);
    await onClick();
    setLoading(false);
  }, [onClick]);

  return loading ? (
    <Spinner />
  ) : (
    <IconButton
      tooltipPlacement="top"
      tooltip={tooltip}
      onClick={handleClick}
      name={silenced ? 'percona-bell' : 'percona-bell-slash'}
      iconType="mono"
      data-testid="silence-button"
      title={tooltip}
    ></IconButton>
  );
};

import React, { FC } from 'react';

import { Tooltip } from '@grafana/ui';

type Props = {
  visible: boolean;
};

const DisabledTooltip: FC<Props> = ({ children, visible = false }) => {
  if (!visible) {
    return <>{children}</>;
  }

  return (
    <Tooltip content="You do not appear to have any compatible datasources." placement="top">
      <div>{children}</div>
    </Tooltip>
  );
};

export { DisabledTooltip };

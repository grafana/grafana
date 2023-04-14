import React from 'react';

import { Tooltip } from '@grafana/ui';

type Props = {
  visible: boolean;
};

const DisabledTooltip = ({ children, visible = false }: React.PropsWithChildren<Props>) => {
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

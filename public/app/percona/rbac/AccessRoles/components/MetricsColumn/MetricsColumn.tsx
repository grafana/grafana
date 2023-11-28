import React, { FC } from 'react';

import { Icon, Tooltip } from '@grafana/ui';

import { Messages } from '../../AccessRole.messages';

const MetricsColumn: FC<React.PropsWithChildren<unknown>> = () => (
  <span>
    {Messages.metrics.column}
    <Tooltip content={Messages.metrics.tooltip} theme="info">
      <Icon name="info-circle" />
    </Tooltip>
  </span>
);

export default MetricsColumn;

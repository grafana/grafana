import React, { FC } from 'react';

import { HorizontalGroup, Icon, Tooltip } from '@grafana/ui';

import { Messages } from './AccessRoleHeader.messages';

const AccessRoleHeader: FC = () => (
  <th>
    <HorizontalGroup>
      <span data-testid="access-role-header">{Messages.header}</span>
      <Tooltip content={Messages.tooltip}>
        <Icon name="info-circle" />
      </Tooltip>
    </HorizontalGroup>
  </th>
);

export default AccessRoleHeader;

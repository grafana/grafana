import React, { FC } from 'react';

import { Text } from '@grafana/ui';

import { Messages } from './FailedMigrationRow.messages';
import { FailedMigrationRowProps } from './FailedMigrationRow.types';
import { parseDetail } from './FailedMigrationRow.utils';

const FailedMigrationRow: FC<FailedMigrationRowProps> = ({ id, details }) => {
  const { name, error } = parseDetail(details);

  return (
    <li>
      <strong>{Messages.id(id)}</strong>
      <ul>
        {!!name && (
          <li>
            <Text>
              <strong>{Messages.name}</strong>
              {name}
            </Text>
          </li>
        )}
        <li>
          <Text>
            <strong>{Messages.error}</strong>
            {error}
          </Text>
        </li>
      </ul>
    </li>
  );
};

export default FailedMigrationRow;

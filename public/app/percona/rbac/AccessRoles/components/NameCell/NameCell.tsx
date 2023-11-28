import React, { FC } from 'react';

import { Badge, useStyles2 } from '@grafana/ui';

import { Messages } from '../../AccessRole.messages';

import { getStyles } from './NameCell.styles';
import { NameCellProps } from './NameCell.types';

const NameCell: FC<React.PropsWithChildren<NameCellProps>> = ({ role }) => {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <span>{role.title}</span>
      {role.isDefault && (
        <Badge
          data-testid="role-default-badge"
          className={styles.button}
          color="blue"
          text={Messages.default.text}
          tooltip={Messages.default.tooltip}
        />
      )}
    </div>
  );
};

export default NameCell;

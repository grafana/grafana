import React, { FC } from 'react';
import { css } from 'emotion';
import { Icon, IconName, useTheme } from '@grafana/ui';

export interface Props {
  child: any;
}

const DropDownChild: FC<Props> = props => {
  const { child } = props;
  const listItemClassName = child.divider ? 'divider' : '';
  const theme = useTheme();

  return (
    <li className={listItemClassName}>
      <a href={child.url}>
        {child.icon && (
          <Icon
            name={child.icon as IconName}
            size="lg"
            className={css`
              margin-right: ${theme.spacing.sm};
              margin-bottom: ${theme.spacing.xxs};
            `}
          />
        )}
        {child.text}
      </a>
    </li>
  );
};

export default DropDownChild;

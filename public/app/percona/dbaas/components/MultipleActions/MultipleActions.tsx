/* eslint-disable react/display-name */
import { Dropdown } from '@percona/platform-core';
import React, { FC, Fragment } from 'react';

import { IconButton, Tooltip, useTheme } from '@grafana/ui';

import { getStyles } from './MultipleActions.styles';
import { MultipleActionsProps } from './MultipleActions.types';

export const MultipleActions: FC<MultipleActionsProps> = ({ actions, disabled, dataTestId }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const Toggle = React.forwardRef<HTMLButtonElement>((props, ref) => (
    <Tooltip content="Actions" placement="top">
      <span className={styles.iconWrapper}>
        <IconButton
          name="ellipsis-v"
          size="xl"
          disabled={disabled}
          data-testid={dataTestId}
          ref={ref}
          className={styles.icon}
          {...props}
        />
      </span>
    </Tooltip>
  ));

  return (
    <Dropdown toggle={Toggle} data-testid="multiple-actions-dropdown">
      {actions.map(({ content, action, disabled }, index) => (
        <Fragment key={index}>
          {disabled ? (
            <span className={styles.disabledButton} data-testid="disabled-dropdown-button">
              {content}
            </span>
          ) : (
            <span onClick={action} data-testid="dropdown-button">
              {content}
            </span>
          )}
        </Fragment>
      ))}
    </Dropdown>
  );
};

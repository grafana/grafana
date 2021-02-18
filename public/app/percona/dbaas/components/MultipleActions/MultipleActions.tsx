import React, { FC } from 'react';
import { IconButton, useTheme } from '@grafana/ui';
import { Dropdown } from '@percona/platform-core';
import { MultipleActionsProps } from './MultipleActions.types';
import { getStyles } from './MultipleActions.styles';

export const MultipleActions: FC<MultipleActionsProps> = ({ actions, disabled, dataQa }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const Toggle = React.forwardRef<HTMLButtonElement>((props, ref) => (
    <IconButton name="ellipsis-v" size="xl" disabled={disabled} data-qa={dataQa} ref={ref} {...props} />
  ));

  return (
    <Dropdown toggle={Toggle}>
      {actions.map(({ title, action, disabled }) => (
        <>
          {disabled ? (
            <span key={title} className={styles.disabledButton}>
              {title}
            </span>
          ) : (
            <span key={title} onClick={action}>
              {title}
            </span>
          )}
        </>
      ))}
    </Dropdown>
  );
};

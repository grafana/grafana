import { t } from 'i18next';
import * as React from 'react';

import { useTheme2 } from '../../themes';
import { IconButton, Props as IconButtonProps } from '../IconButton/IconButton';

import { getSelectStyles } from './getSelectStyles';

interface MultiValueContainerProps {
  innerProps: JSX.IntrinsicElements['div'];
}

export const MultiValueContainer = ({ innerProps, children }: React.PropsWithChildren<MultiValueContainerProps>) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);

  return (
    <div {...innerProps} className={styles.multiValueContainer}>
      {children}
    </div>
  );
};

export type MultiValueRemoveProps = {
  innerProps: IconButtonProps;
};

export const MultiValueRemove = ({ children, innerProps }: React.PropsWithChildren<MultiValueRemoveProps>) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  {
    /*BMC Change: To enable localization for below text*/
  }
  return (
    <IconButton
      {...innerProps}
      name="times"
      size="sm"
      className={styles.multiValueRemove}
      tooltip={t('bmcgrafana.dashboards.edit-panel.remove-text', 'Remove')}
    />
  );
  // BMC Change ends
};

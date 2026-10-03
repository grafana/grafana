import { cx } from '@emotion/css';
import * as React from 'react';
import type { JSX } from 'react';

import { t } from '@grafana/i18n';

import { useTheme2 } from '../../themes/ThemeContext';
import { IconButton, type Props as IconButtonProps } from '../IconButton/IconButton';

import { getSelectStyles } from './getSelectStyles';
import { getQueryBuilderSelectRole } from './utils';

interface MultiValueContainerProps {
  innerProps: JSX.IntrinsicElements['div'];
  selectProps?: { 'data-testid'?: unknown };
}

export const MultiValueContainer = ({
  innerProps,
  children,
  selectProps,
}: React.PropsWithChildren<MultiValueContainerProps>) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const constrainChip = getQueryBuilderSelectRole(selectProps?.['data-testid']) === 'value';

  return (
    <div
      {...innerProps}
      className={cx(styles.multiValueContainer, constrainChip && styles.multiValueContainerConstrained)}
    >
      {children}
    </div>
  );
};

interface MultiValueLabelProps {
  innerProps: JSX.IntrinsicElements['div'];
}

export const MultiValueLabel = ({ innerProps, children }: React.PropsWithChildren<MultiValueLabelProps>) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);

  return (
    <div {...innerProps} className={styles.multiValueLabel}>
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
  return (
    <IconButton
      {...innerProps}
      name="times"
      size="sm"
      className={styles.multiValueRemove}
      tooltip={t('grafana-ui.select.multi-value-remove', 'Remove')}
    />
  );
};

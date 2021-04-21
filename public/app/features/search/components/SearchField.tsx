import React, { FC } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { DashboardQuery } from '../types';
import { useStyles } from '@grafana/ui';

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

interface SearchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  query: DashboardQuery;
  onChange: (query: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  clearable?: boolean;
  width?: number;
}

const getSearchFieldStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    width: 100%;
    display: flex;
    position: relative;
    align-items: center;
  `,
  input: css`
    box-sizing: border-box;
    outline: none;
    background-color: transparent;
    background: transparent;
    border-bottom: 2px solid ${theme.colors.border1};
    font-size: 20px;
    line-height: 38px;
    width: 100%;

    &::placeholder {
      color: ${theme.colors.textWeak};
    }
  `,
  spacer: css`
    flex-grow: 1;
  `,
  icon: cx(
    css`
      color: ${theme.colors.textWeak};
      padding: 0 ${theme.spacing.md};
    `
  ),
  clearButton: css`
    font-size: ${theme.typography.size.sm};
    color: ${theme.colors.textWeak};
    text-decoration: underline;

    &:hover {
      cursor: pointer;
      color: ${theme.colors.textStrong};
    }
  `,
});

export const SearchField: FC<SearchFieldProps> = ({ query, onChange, size, clearable, className, ...inputProps }) => {
  const styles = useStyles(getSearchFieldStyles);

  return (
    <div className={cx(styles.wrapper, className)}>
      <input
        type="text"
        placeholder="Search dashboards by name"
        value={query.query}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          onChange(event.currentTarget.value);
        }}
        tabIndex={1}
        spellCheck={false}
        className={styles.input}
        {...inputProps}
      />

      <div className={styles.spacer} />
    </div>
  );
};

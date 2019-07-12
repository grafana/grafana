import React, { useContext } from 'react';
// @ts-ignore
import tinycolor from 'tinycolor2';
import { SearchQuery } from './search';
import { css, cx } from 'emotion';
import { ThemeContext, GrafanaTheme, selectThemeVariant } from '@grafana/ui';

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

interface SearchFieldProps extends Omit<React.HTMLAttributes<HTMLInputElement>, 'onChange'> {
  query: SearchQuery;
  onChange: (query: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const getSearchFieldStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    width: 100%;
    height: 55px; /* this variable is not part of GrafanaTheme yet*/
    display: flex;
    background-color: ${selectThemeVariant(
      {
        light: theme.colors.white,
        dark: theme.colors.dark4,
      },
      theme.type
    )};
    position: relative;
  `,
  input: css`
    max-width: 653px;
    padding: ${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.sm} ${theme.spacing.md};
    height: 51px;
    box-sizing: border-box;
    outline: none;
    background: ${selectThemeVariant(
      {
        light: theme.colors.dark1,
        dark: theme.colors.black,
      },
      theme.type
    )};
    background-color: ${selectThemeVariant(
      {
        light: tinycolor(theme.colors.white)
          .lighten(4)
          .toString(),
        dark: theme.colors.dark4,
      },
      theme.type
    )};
    flex-grow: 10;
  `,
  spacer: css`
    flex-grow: 1;
  `,
  icon: cx(
    css`
      font-size: ${theme.typography.size.lg};
      padding: ${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.sm} ${theme.spacing.md};
    `,
    'pointer'
  ),
});

export const SearchField: React.FunctionComponent<SearchFieldProps> = ({ query, onChange, ...inputProps }) => {
  const theme = useContext(ThemeContext);
  const styles = getSearchFieldStyles(theme);

  return (
    <>
      {/* search-field-wrapper class name left on purpose until we migrate entire search to React */}
      {/* based on it GrafanaCtrl (L256) decides whether or not hide search */}
      <div className={`${styles.wrapper} search-field-wrapper`}>
        <div className={styles.icon}>
          <i className="fa fa-search" />
        </div>

        <input
          type="text"
          placeholder="Find dashboards by name"
          value={query.query}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            onChange(event.currentTarget.value);
          }}
          tabIndex={1}
          spellCheck={false}
          {...inputProps}
          className={styles.input}
        />

        <div className={styles.spacer} />
      </div>
    </>
  );
};

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

export interface Props {
  children: JSX.Element | string;
}

/** @deprecated Use <EmptyState variant="not-found" /> instead */
const EmptySearchResult = ({ children }: Props) => {
  const styles = useStyles2(getStyles);
  return <div className={styles.container}>{children}</div>;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      borderLeft: `3px solid ${theme.colors.info.main}`,
      backgroundColor: `${theme.colors.background.secondary}`,
      padding: theme.spacing(2),
      minWidth: '350px',
      borderRadius: theme.shape.radius.default,
      marginBottom: theme.spacing(4),
    }),
  };
};
export { EmptySearchResult };

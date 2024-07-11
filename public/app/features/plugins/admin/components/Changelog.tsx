import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { CatalogPlugin } from '../types';

interface Props {
  plugin: CatalogPlugin;
}

export const Changelog = ({ plugin }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div
      dangerouslySetInnerHTML={{ __html: plugin.details?.changelog ?? 'No changelog was found' }}
      className={cx(styles.changelog, styles.container)}
    ></div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(2, 4, 3)};
  `,
  changelog: css({
    h1: {
      display: 'none',
    },
    'h2:first-of-type': {
      marginTop: 0,
    },
    h2: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
    },
    li: {
      marginLeft: theme.spacing(4),
    },
    a: {
      color: theme.colors.text.link,
      '&:hover': {
        color: theme.colors.text.link,
        textDecoration: 'underline',
      },
    },
  }),
});

import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  sanitizedHTML: string;
}

export const Changelog = ({ sanitizedHTML }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div
      dangerouslySetInnerHTML={{ __html: sanitizedHTML ?? 'No changelog was found' }}
      className={cx(styles.changelog)}
    ></div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  changelog: css({
    'h1:first-of-type': {
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

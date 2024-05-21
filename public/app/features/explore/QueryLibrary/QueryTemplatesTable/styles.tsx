import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data/';
import { useStyles2 } from '@grafana/ui/';

export const useQueryLibraryListStyles = () => {
  return useStyles2(getStyles);
};

const getStyles = (theme: GrafanaTheme2) => ({
  logo: css({
    marginRight: theme.spacing(2),
    width: '16px',
  }),
  header: css({
    margin: 0,
    fontSize: theme.typography.h5.fontSize,
    color: theme.colors.text.secondary,
  }),
  mainText: css({
    margin: 0,
    fontSize: theme.typography.body.fontSize,
    textOverflow: 'ellipsis',
  }),
  otherText: css({
    margin: 0,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.secondary,
    textOverflow: 'ellipsis',
  }),
  singleLine: css({
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 1,
    overflow: 'hidden',
  }),
});

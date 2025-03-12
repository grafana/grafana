import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';

export const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  wrapper: css({
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(1),
    width: '100%',
  }),
  list: css({
    marginTop: theme.spacing(1),
    display: 'flex',
    flexWrap: 'wrap',
    maxHeight: '200px',
    overflow: 'auto',
    alignContent: 'flex-start',
  }),
  section: css({
    '& + &': {
      margin: `${theme.spacing(2)} 0`,
    },
    position: 'relative',
  }),
  selector: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    marginBottom: theme.spacing(1),
  }),
  status: css({
    padding: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    /* using absolute positioning because flex interferes with ellipsis */
    position: 'absolute',
    width: '50%',
    right: 0,
    textAlign: 'right',
    opacity: 0,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'opacity 100ms linear',
    },
  }),
  statusShowing: css({
    opacity: 1,
  }),
  error: css({
    color: theme.colors.error.main,
  }),
  valueList: css({
    marginRight: theme.spacing(1),
    resize: 'horizontal',
  }),
  valueListWrapper: css({
    borderLeft: `1px solid ${theme.colors.border.medium}`,
    margin: `${theme.spacing(1)} 0`,
    padding: `${theme.spacing(1)} 0 ${theme.spacing(1)} ${theme.spacing(1)}`,
  }),
  valueListArea: css({
    display: 'flex',
    flexWrap: 'wrap',
    marginTop: theme.spacing(1),
  }),
  valueTitle: css({
    marginLeft: `-${theme.spacing(0.5)}`,
    marginBottom: theme.spacing(1),
  }),
  validationStatus: css({
    padding: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
    color: theme.colors.text.maxContrast,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
}));

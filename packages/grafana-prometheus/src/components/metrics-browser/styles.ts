import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStylesMetricsBrowser = (theme: GrafanaTheme2) => ({
  wrapper: css({
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(1),
    width: '100%',
  }),
  spinner: css({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 120,
  }),
});

export const getStylesMetricSelector = (theme: GrafanaTheme2) => ({
  section: css({
    '& + &': {
      margin: `${theme.spacing(2)} 0`,
    },
    position: 'relative',
  }),
  valueListWrapper: css({
    borderLeft: `1px solid ${theme.colors.border.medium}`,
    margin: `${theme.spacing(1)} 0`,
    padding: `${theme.spacing(1)} 0 ${theme.spacing(1)} ${theme.spacing(1)}`,
  }),
  valueList: css({
    marginRight: theme.spacing(1),
    resize: 'horizontal',
  }),
});

export const getStylesLabelSelector = (theme: GrafanaTheme2) => ({
  section: css({
    '& + &': {
      margin: `${theme.spacing(2)} 0`,
    },
    position: 'relative',
  }),
  list: css({
    marginTop: theme.spacing(1),
    display: 'flex',
    flexWrap: 'wrap',
    maxHeight: '200px',
    overflow: 'auto',
    alignContent: 'flex-start',
  }),
});

export const getStylesValueSelector = (theme: GrafanaTheme2) => ({
  section: css({
    '& + &': {
      margin: `${theme.spacing(2)} 0`,
    },
    position: 'relative',
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
  valueListWrapper: css({
    borderLeft: `1px solid ${theme.colors.border.medium}`,
    margin: `${theme.spacing(1)} 0`,
    padding: `${theme.spacing(1)} 0 ${theme.spacing(1)} ${theme.spacing(1)}`,
  }),
  valueList: css({
    marginRight: theme.spacing(1),
    resize: 'horizontal',
  }),
});

export const getStylesSelectorActions = (theme: GrafanaTheme2) => ({
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
    width: '100%',
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
  validationStatus: css({
    padding: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
    color: theme.colors.text.maxContrast,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
});

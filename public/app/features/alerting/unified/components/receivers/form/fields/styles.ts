import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getReceiverFormFieldStyles = (theme: GrafanaTheme2) => ({
  collapsibleSection: css({
    margin: 0,
    padding: 0,
  }),
  wrapper: css({
    margin: theme.spacing(2, 0),
    padding: theme.spacing(1),
    border: `solid 1px ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    position: 'relative',
  }),
  description: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.fontWeightRegular,
    margin: 0,
  }),
  deleteIcon: css({
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
  }),
  addButton: css({
    marginTop: theme.spacing(1),
  }),
});

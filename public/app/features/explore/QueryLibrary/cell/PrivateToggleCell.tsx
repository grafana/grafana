import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/';
import { useStyles2 } from '@grafana/ui';
import { Switch } from '@grafana/ui/src/components/Switch/Switch';

import { useQueryLibraryListStyles } from './styles';

export function PrivateToggleCell() {
  const styles = useStyles2(getStyles);
  const queryLibraryStyles = useQueryLibraryListStyles();
  return (
    <div className={cx(styles.toggleContainer, queryLibraryStyles.otherText)}>
      <span>Private query</span>
      <Switch disabled={true} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  toggleContainer: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    border: `1px solid ${theme.components.input.borderColor}`,
  }),
});

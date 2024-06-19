import { css, cx } from '@emotion/css';
import React from 'react';

import { AdHocVariableFilter, DataSourceRef, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Box, useStyles2 } from '@grafana/ui';

interface Props {
  datasource: DataSourceRef;
  filter: AdHocVariableFilter;
}

export const SnapshotFilterRenderer = ({ datasource, filter: { key, operator, value } }: Props) => {
  // render read-only filters using the key, operator, and value
  const styles = useStyles2(getStyles);
  const keyElement = `filter-key-${key}-value-${value}`;
  return (
    <Box
      display="flex"
      marginRight={1}
      alignItems="flex-end"
      key={keyElement}
      data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}
    >
      <span className={styles.disabledElement}> {key}</span>
      <span className={cx(styles.disabledElement, styles.operator)}> {operator}</span>
      <span className={styles.disabledElement}> {value}</span>
    </Box>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    disabledElement: css({
      label: 'snapshot-filter-renderer-disabled-element',
      display: 'flex',
      borderColor: `${theme.colors.border.weak}`,
      borderWidth: `${theme.spacing(0.1)} `,
      borderStyle: 'solid',
      alignItems: 'center',
      padding: `${theme.spacing(0.5)} `,
      backgroundColor: theme.colors.action.disabledBackground,
      color: theme.colors.action.disabledText,
      cursor: 'not-allowed',
    }),
    operator: css({
      borderLeft: '0px',
      borderRight: '0px',
    }),
  };
}

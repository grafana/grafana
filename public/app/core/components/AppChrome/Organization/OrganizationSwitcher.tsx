import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, Icon, useStyles2 } from '@grafana/ui';

import { OrganizationSelect } from './OrganizationSelect';

export function OrganizationSwitcher() {
  const styles = useStyles2(getStyles);

  return (
    <>
      <div className={styles.select}>
        <OrganizationSelect />
      </div>
      <div className={styles.dropdown}>
        <Dropdown overlay={() => <OrganizationSelect />}>
          <button className={styles.button}>
            <Icon name="building" size="lg" />
          </button>
        </Dropdown>
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  dropdown: css({
    [theme.breakpoints.up('sm')]: {
      display: 'none',
    },
  }),
  button: css({
    border: 'none',
    background: 'none',
    alignItems: 'center',
    color: theme.colors.text.secondary,
    '&:hover': {
      background: theme.colors.background.secondary,
    },
  }),

  select: css({
    display: 'none',
    [theme.breakpoints.up('sm')]: {
      display: 'block',
    },
  }),
});

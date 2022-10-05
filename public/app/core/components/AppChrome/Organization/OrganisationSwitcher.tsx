import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, Icon, useStyles2 } from '@grafana/ui';

import { OrganisationSelect } from './OrganisationSelect';

export function OrganisationSwitcher() {
  const styles = useStyles2(getStyles);

  return (
    <>
      <div className={styles.select}>
        <OrganisationSelect />
      </div>
      <div className={styles.dropdown}>
        <Dropdown overlay={() => <OrganisationSelect />}>
          <button className={styles.button}>
            <Icon name="building" size="lg" />
          </button>
        </Dropdown>
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  dropdown: css`
    ${theme.breakpoints.up('sm')} {
      display: none;
    }
  `,

  button: css`
    border: none;
    background: none;
    alignitems: center;
    color: ${theme.colors.text.secondary};

    &:hover {
      background: ${theme.colors.background.secondary};
    }
  `,

  select: css`
    display: none;

    ${theme.breakpoints.up('sm')} {
      margin: ${theme.spacing(0, 1)};
      display: block;
    }
  `,
});

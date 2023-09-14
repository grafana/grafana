import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { Unit } from 'app/types';

type OrgUnitProps = { units?: Unit[]; icon: IconName };

export const OrgUnits = ({ units, icon }: OrgUnitProps) => {
  const styles = useStyles2(getStyles);

  if (!units?.length) {
    return null;
  }

  return units.length > 1 ? (
    <Tooltip
      placement={'top'}
      content={
        <div className={styles.unitTooltip}>{units?.map((unit) => <span key={unit.name}>{unit.name}</span>)}</div>
      }
    >
      <div className={styles.unitItem}>
        <Icon name={icon} /> <span>{units.length}</span>
      </div>
    </Tooltip>
  ) : (
    <span className={styles.unitItem}>
      <Icon name={icon} /> {units[0].name}
    </span>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    unitTooltip: css`
      display: flex;
      flex-direction: column;
    `,
    unitItem: css`
      padding: ${theme.spacing(0.5)} 0;
      margin-right: ${theme.spacing(1)};

      svg {
        margin-bottom: ${theme.spacing(0.25)};
      }
    `,
    link: css`
      color: inherit;
      cursor: pointer;
      text-decoration: underline;
    `,
  };
};

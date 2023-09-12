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
        <div className={styles.unitTooltip}>
          {units?.map((unit) => (
            <a
              href={unit.url}
              className={styles.link}
              title={unit.name}
              key={unit.name}
              aria-label={`Edit ${unit.name}`}
            >
              {unit.name}
            </a>
          ))}
        </div>
      }
    >
      <div className={styles.unitItem}>
        <Icon name={icon} /> <span>{units.length}</span>
      </div>
    </Tooltip>
  ) : (
    <a
      href={units[0].url}
      className={styles.unitItem}
      title={units[0].name}
      key={units[0].name}
      aria-label={`Edit ${units[0].name}`}
    >
      <Icon name={icon} /> {units[0].name}
    </a>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    unitTooltip: css`
      display: flex;
      flex-direction: column;
    `,
    unitItem: css`
      cursor: pointer;
      padding: ${theme.spacing(0.5)} 0;
      margin-right: ${theme.spacing(1)};
    `,
    link: css`
      color: inherit;
      cursor: pointer;
      text-decoration: underline;
    `,
  };
};

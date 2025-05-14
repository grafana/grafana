import { css } from '@emotion/css';
import * as React from 'react';
import { useToggle } from 'react-use';

import { getValueFormat, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Collapse, Icon, Tooltip, useStyles2, Stack } from '@grafana/ui';

import { QueryStats } from '../loki/types';

export interface Props {
  title: string;
  collapsedInfo: string[];
  queryStats?: QueryStats | null;
  children: React.ReactNode;
  onToggle?: (isOpen: boolean) => void;
  isOpen?: boolean;
}

export function QueryOptionGroup({ title, children, collapsedInfo, queryStats, onToggle, isOpen: propsIsOpen }: Props) {
  const [isOpen, toggleOpen] = useToggle(false);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <Collapse
        className={styles.collapse}
        collapsible
        isOpen={propsIsOpen ?? isOpen}
        onToggle={onToggle ?? toggleOpen}
        label={
          <Stack gap={0}>
            <h6 className={styles.title}>{title}</h6>
            {!isOpen && (
              <div className={styles.description}>
                {collapsedInfo.map((x, i) => (
                  <span key={i}>{x}</span>
                ))}
              </div>
            )}
          </Stack>
        }
      >
        <div className={styles.body}>{children}</div>
      </Collapse>

      {queryStats && config.featureToggles.lokiQuerySplitting && (
        <Tooltip content="Note: the query will be split into multiple parts and executed in sequence. Query limits will only apply each individual part.">
          <Icon tabIndex={0} name="info-circle" className={styles.tooltip} size="sm" />
        </Tooltip>
      )}

      {queryStats && <p className={styles.stats}>{generateQueryStats(queryStats)}</p>}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    collapse: css({
      backgroundColor: 'unset',
      border: 'unset',
      marginBottom: 0,

      ['> button']: {
        padding: theme.spacing(0, 1),
      },
    }),
    wrapper: css({
      width: '100%',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    }),
    title: css({
      flexGrow: 1,
      overflow: 'hidden',
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      margin: 0,
    }),
    description: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.bodySmall.fontWeight,
      paddingLeft: theme.spacing(2),
      gap: theme.spacing(2),
      display: 'flex',
    }),
    body: css({
      display: 'flex',
      gap: theme.spacing(2),
      flexWrap: 'wrap',
    }),
    stats: css({
      margin: '0px',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    tooltip: css({
      marginRight: theme.spacing(0.25),
    }),
  };
};

const generateQueryStats = (queryStats: QueryStats) => {
  if (queryStats.message) {
    return queryStats.message;
  }

  return `This query will process approximately ${convertUnits(queryStats)}.`;
};

const convertUnits = (queryStats: QueryStats): string => {
  const { text, suffix } = getValueFormat('bytes')(queryStats.bytes, 1);
  return text + suffix;
};

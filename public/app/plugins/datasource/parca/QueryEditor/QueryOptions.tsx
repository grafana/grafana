import { css, cx } from '@emotion/css';
import React from 'react';
import { useToggle } from 'react-use';

import { CoreApp, GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, RadioButtonGroup, Field, clearButtonStyles, Button } from '@grafana/ui';

import { Query } from '../types';

import { Stack } from './Stack';

export interface Props {
  query: Query;
  onQueryTypeChange: (val: Query['queryType']) => void;
  app?: CoreApp;
}

const rangeOptions: Array<{ value: Query['queryType']; label: string; description: string }> = [
  { value: 'metrics', label: 'Metric', description: 'Return aggregated metrics' },
  { value: 'profile', label: 'Profile', description: 'Return profile' },
  { value: 'both', label: 'Both', description: 'Return both metric and profile data' },
];

function getOptions(app?: CoreApp) {
  if (app === CoreApp.Explore) {
    return rangeOptions;
  }
  return rangeOptions.filter((option) => option.value !== 'both');
}

/**
 * Base on QueryOptionGroup component from grafana/ui but that is not available yet.
 */
export function QueryOptions({ query, onQueryTypeChange, app }: Props) {
  const [isOpen, toggleOpen] = useToggle(false);
  const styles = useStyles2(getStyles);
  const options = getOptions(app);
  const buttonStyles = useStyles2(clearButtonStyles);

  return (
    <Stack gap={0} direction="column">
      <Button className={cx(styles.header, buttonStyles)} onClick={toggleOpen} title="Click to edit options">
        <div className={styles.toggle}>
          <Icon name={isOpen ? 'angle-down' : 'angle-right'} />
        </div>
        <h6 className={styles.title}>Options</h6>
        {!isOpen && (
          <div className={styles.description}>
            <span>Type: {query.queryType}</span>
          </div>
        )}
      </Button>
      {isOpen && (
        <div className={styles.body}>
          <Field label={'Query Type'}>
            <RadioButtonGroup options={options} value={query.queryType} onChange={onQueryTypeChange} />
          </Field>
        </div>
      )}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    switchLabel: css({
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
    header: css({
      display: 'flex',
      cursor: 'pointer',
      alignItems: 'baseline',
      color: theme.colors.text.primary,
      '&:hover': {
        background: theme.colors.emphasize(theme.colors.background.primary, 0.03),
      },
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
      paddingLeft: theme.spacing(2),
      gap: theme.spacing(2),
      display: 'flex',
    }),
    body: css({
      display: 'flex',
      paddingTop: theme.spacing(2),
      gap: theme.spacing(2),
      flexWrap: 'wrap',
    }),
    toggle: css({
      color: theme.colors.text.secondary,
      marginRight: `${theme.spacing(1)}`,
    }),
  };
};

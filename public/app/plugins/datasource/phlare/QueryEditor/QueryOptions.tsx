import { css } from '@emotion/css';
import React from 'react';
import { useToggle } from 'react-use';

import { CoreApp, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Icon, useStyles2, RadioButtonGroup, MultiSelect } from '@grafana/ui';

import { Query } from '../types';

import { EditorField } from './EditorField';
import { Stack } from './Stack';

export interface Props {
  query: Query;
  onQueryChange: (query: Query) => void;
  app?: CoreApp;
  labels?: string[];
}

const typeOptions: Array<{ value: Query['queryType']; label: string; description: string }> = [
  { value: 'metrics', label: 'Metric', description: 'Return aggregated metrics' },
  { value: 'profile', label: 'Profile', description: 'Return profile' },
  { value: 'both', label: 'Both', description: 'Return both metric and profile data' },
];

function getTypeOptions(app?: CoreApp) {
  if (app === CoreApp.Explore) {
    return typeOptions;
  }
  return typeOptions.filter((option) => option.value !== 'both');
}

/**
 * Base on QueryOptionGroup component from grafana/ui but that is not available yet.
 */
export function QueryOptions({ query, onQueryChange, app, labels }: Props) {
  const [isOpen, toggleOpen] = useToggle(false);
  const styles = useStyles2(getStyles);
  const typeOptions = getTypeOptions(app);
  const groupByOptions = labels
    ? labels.map((l) => ({
        label: l,
        value: l,
      }))
    : [];

  return (
    <Stack gap={0} direction="column">
      <div className={styles.header} onClick={toggleOpen} title="Click to edit options">
        <div className={styles.toggle}>
          <Icon name={isOpen ? 'angle-down' : 'angle-right'} />
        </div>
        <h6 className={styles.title}>Options</h6>
        {!isOpen && (
          <div className={styles.description}>
            {[`Type: ${query.queryType}`, query.groupBy?.length ? `Group by: ${query.groupBy.join(', ')}` : undefined]
              .filter((v) => v)
              .map((v, i) => (
                <span key={i}>{v}</span>
              ))}
          </div>
        )}
      </div>
      {isOpen && (
        <div className={styles.body}>
          <EditorField label={'Query Type'}>
            <RadioButtonGroup
              options={typeOptions}
              value={query.queryType}
              onChange={(value) => onQueryChange({ ...query, queryType: value })}
            />
          </EditorField>
          <EditorField
            label={'Group by'}
            tooltip={
              <>
                Used to group the metric result by a specific label or set of labels. Does not apply to profile query.
              </>
            }
          >
            <MultiSelect
              placeholder="Label"
              value={query.groupBy}
              allowCustomValue
              options={groupByOptions}
              onChange={(change) => {
                const changes = change.map((c: SelectableValue<string>) => {
                  return c.value!;
                });
                onQueryChange({ ...query, groupBy: changes });
              }}
            />
          </EditorField>
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

import { css } from '@emotion/css';
import * as React from 'react';

import { CoreApp, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { useStyles2, RadioButtonGroup, MultiSelect, Input, InlineSwitch } from '@grafana/ui';

import { Query } from '../types';

import { EditorField } from './EditorField';
import { QueryOptionGroup } from './QueryOptionGroup';
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
  const styles = useStyles2(getStyles);
  const typeOptions = getTypeOptions(app);
  const groupByOptions = labels
    ? labels.map((l) => ({
        label: l,
        value: l,
      }))
    : [];

  let collapsedInfo = [`Type: ${query.queryType}`];
  if (query.groupBy?.length) {
    collapsedInfo.push(`Group by: ${query.groupBy.join(', ')}`);
  }
  if (query.limit) {
    collapsedInfo.push(`Limit: ${query.limit}`);
  }
  if (query.spanSelector?.length) {
    collapsedInfo.push(`Span ID: ${query.spanSelector.join(', ')}`);
  }
  if (query.maxNodes) {
    collapsedInfo.push(`Max nodes: ${query.maxNodes}`);
  }

  return (
    <Stack gap={0} direction="column">
      <QueryOptionGroup title="Options" collapsedInfo={collapsedInfo}>
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
          <EditorField
            label={'Limit'}
            tooltip={
              <>
                When &quot;Group by&quot; is set, limits the maximum number of series to return. Does not apply to
                profile query.
              </>
            }
          >
            <Input
              value={query.limit || ''}
              type="number"
              placeholder="0"
              onChange={(event: React.SyntheticEvent<HTMLInputElement>) => {
                let newValue = parseInt(event.currentTarget.value, 10);
                newValue = isNaN(newValue) ? 0 : newValue;
                onQueryChange({ ...query, limit: newValue });
              }}
            />
          </EditorField>
          <EditorField label={'Span ID'} tooltip={<>Sets the span ID from which to search for profiles.</>}>
            <Input
              value={query.spanSelector || ['']}
              type="string"
              placeholder="64f170a95f537095"
              onChange={(event: React.SyntheticEvent<HTMLInputElement>) => {
                onQueryChange({
                  ...query,
                  spanSelector: event.currentTarget.value !== '' ? [event.currentTarget.value] : [],
                });
              }}
            />
          </EditorField>
          <EditorField label={'Max Nodes'} tooltip={<>Sets the maximum number of nodes to return in the flamegraph.</>}>
            <Input
              value={query.maxNodes || ''}
              type="number"
              placeholder="16384"
              onChange={(event: React.SyntheticEvent<HTMLInputElement>) => {
                let newValue = parseInt(event.currentTarget.value, 10);
                newValue = isNaN(newValue) ? 0 : newValue;
                onQueryChange({ ...query, maxNodes: newValue });
              }}
            />
          </EditorField>
          <EditorField label={'Annotations'} tooltip={<>Include profiling annotations in the time series.</>}>
            <InlineSwitch
              value={query.annotations || false}
              onChange={(event: React.SyntheticEvent<HTMLInputElement>) => {
                onQueryChange({ ...query, annotations: event.currentTarget.checked });
              }}
            />
          </EditorField>
        </div>
      </QueryOptionGroup>
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
    body: css({
      display: 'flex',
      paddingTop: theme.spacing(2),
      gap: theme.spacing(2),
      flexWrap: 'wrap',
    }),
  };
};

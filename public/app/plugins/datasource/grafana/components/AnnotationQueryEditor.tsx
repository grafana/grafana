import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Field, FieldSet, Select, Switch, useStyles2 } from '@grafana/ui';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { TimeRegionConfig } from 'app/core/utils/timeRegions';
import { getAnnotationTags } from 'app/features/annotations/api';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { GrafanaAnnotationQuery, GrafanaAnnotationType, GrafanaQuery, GrafanaQueryType } from '../types';

import { TimeRegionEditor } from './TimeRegionEditor';

const matchTooltipContent = 'Enabling this returns annotations that match any of the tags specified below';

const tagsTooltipContent = (
  <div>Specify a list of tags to match. To specify a key and value tag use `key:value` syntax.</div>
);

const annotationTypes: Array<SelectableValue<GrafanaAnnotationType>> = [
  {
    label: 'Dashboard',
    value: GrafanaAnnotationType.Dashboard,
    description: 'Query for events created on this dashboard and show them in the panels where they where created',
  },
  {
    label: 'Tags',
    value: GrafanaAnnotationType.Tags,
    description: 'This will fetch any annotation events that match the tags filter',
  },
];

const queryTypes: Array<SelectableValue<GrafanaQueryType>> = [
  {
    label: 'Annotations & Alerts',
    value: GrafanaQueryType.Annotations,
    description: 'Show annotations or alerts managed by grafana',
  },
  {
    label: 'Time regions',
    value: GrafanaQueryType.TimeRegions,
    description: 'Configure a repeating time region',
  },
];

const limitOptions = [10, 50, 100, 200, 300, 500, 1000, 2000].map((limit) => ({
  label: String(limit),
  value: limit,
}));

interface Props {
  query: GrafanaQuery;
  onChange: (newValue: GrafanaAnnotationQuery) => void;
}

export default function AnnotationQueryEditor({ query, onChange }: Props) {
  const annotationQuery = query as GrafanaAnnotationQuery;
  const { limit, matchAny, tags, type, queryType } = annotationQuery;
  let grafanaQueryType = queryType ?? GrafanaQueryType.Annotations;
  const defaultTimezone = useMemo(() => getDashboardSrv().dashboard?.getTimezone(), []);
  const styles = useStyles2(getStyles);

  const onFilterByChange = (newValue: SelectableValue<GrafanaAnnotationType>) =>
    onChange({
      ...annotationQuery,
      type: newValue.value!,
    });

  const onMaxLimitChange = (newValue: SelectableValue<number>) =>
    onChange({
      ...annotationQuery,
      limit: newValue.value!,
    });

  const onMatchAnyChange = (newValue: React.ChangeEvent<HTMLInputElement>) =>
    onChange({
      ...annotationQuery,
      matchAny: newValue.target.checked,
    });

  const onTagsChange = (tags: string[]) =>
    onChange({
      ...annotationQuery,
      tags,
    });

  const onQueryTypeChange = (newValue: SelectableValue<GrafanaQueryType>) => {
    const newQuery: GrafanaAnnotationQuery = { ...annotationQuery, queryType: newValue.value! };
    if (newQuery.queryType === GrafanaQueryType.TimeRegions) {
      if (!newQuery.timeRegion) {
        newQuery.timeRegion = {
          timezone: defaultTimezone,
        };
      }
    } else {
      delete newQuery.timeRegion;
    }

    onChange(newQuery);
  };
  const onTimeRegionChange = (timeRegion?: TimeRegionConfig) => {
    onChange({
      ...annotationQuery,
      timeRegion,
    });
  };

  return (
    <FieldSet className={styles.container}>
      <Field label="Query type">
        <Select
          inputId="grafana-annotations__query-type"
          options={queryTypes}
          value={grafanaQueryType}
          onChange={onQueryTypeChange}
        />
      </Field>
      {grafanaQueryType === GrafanaQueryType.Annotations && (
        <>
          <Field label="Filter by">
            <Select
              inputId="grafana-annotations__filter-by"
              options={annotationTypes}
              value={type}
              onChange={onFilterByChange}
            />
          </Field>
          <Field label="Max limit">
            <Select
              inputId="grafana-annotations__limit"
              width={16}
              options={limitOptions}
              value={limit}
              onChange={onMaxLimitChange}
            />
          </Field>
          {type === GrafanaAnnotationType.Tags && (
            <>
              <Field label="Match any" description={matchTooltipContent}>
                <Switch id="grafana-annotations__match-any" value={matchAny} onChange={onMatchAnyChange} />
              </Field>
              <Field label="Tags" description={tagsTooltipContent}>
                <TagFilter
                  allowCustomValue
                  inputId="grafana-annotations__tags"
                  onChange={onTagsChange}
                  tagOptions={getAnnotationTags}
                  tags={tags ?? []}
                />
              </Field>
            </>
          )}
        </>
      )}
      {grafanaQueryType === GrafanaQueryType.TimeRegions && (
        <TimeRegionEditor value={annotationQuery.timeRegion!} onChange={onTimeRegionChange} />
      )}
    </FieldSet>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      maxWidth: theme.spacing(60),
      marginBottom: theme.spacing(2),
    }),
  };
};

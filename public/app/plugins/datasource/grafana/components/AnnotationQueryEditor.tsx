import { css } from '@emotion/css';
import { useMemo } from 'react';
import * as React from 'react';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Field, FieldSet, Select, Switch, useStyles2 } from '@grafana/ui';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { type TimeRegionConfig } from 'app/core/utils/timeRegions';
import { annotationServer } from 'app/features/annotations/api';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { type GrafanaAnnotationQuery, GrafanaAnnotationType, type GrafanaQuery, GrafanaQueryType } from '../types';

import { TimeRegionEditor } from './TimeRegionEditor';

const getAnnotationTypes = (): Array<SelectableValue<GrafanaAnnotationType>> => [
  {
    label: t('grafana-datasource.annotation-query-editor.annotation-types.label.dashboard', 'Dashboard'),
    value: GrafanaAnnotationType.Dashboard,
    description: t(
      'grafana-datasource.annotation-query-editor.annotation-types.description.dashboard',
      'Query for events created on this dashboard and show them in the panels where they where created'
    ),
  },
  {
    label: t('grafana-datasource.annotation-query-editor.annotation-types.label.tags', 'Tags'),
    value: GrafanaAnnotationType.Tags,
    description: t(
      'grafana-datasource.annotation-query-editor.annotation-types.description.tags',
      'This will fetch any annotation events that match the tags filter'
    ),
  },
];

const getQueryTypes = (): Array<SelectableValue<GrafanaQueryType>> => [
  {
    label: t('grafana-datasource.annotation-query-editor.query-types.label.annotations', 'Annotations & Alerts'),
    value: GrafanaQueryType.Annotations,
    description: t(
      'grafana-datasource.annotation-query-editor.query-types.description.annotations',
      'Show annotations or alerts managed by grafana'
    ),
  },
  {
    label: t('grafana-datasource.annotation-query-editor.query-types.label.time-regions', 'Time regions'),
    value: GrafanaQueryType.TimeRegions,
    description: t(
      'grafana-datasource.annotation-query-editor.query-types.description.time-regions',
      'Configure a repeating time region'
    ),
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
      <Field label={t('grafana-datasource.annotation-query-editor.label-query-type', 'Query type')}>
        <Select
          inputId="grafana-annotations__query-type"
          options={getQueryTypes()}
          value={grafanaQueryType}
          onChange={onQueryTypeChange}
        />
      </Field>
      {grafanaQueryType === GrafanaQueryType.Annotations && (
        <>
          <Field label={t('grafana-datasource.annotation-query-editor.label-filter-by', 'Filter by')}>
            <Select
              inputId="grafana-annotations__filter-by"
              options={getAnnotationTypes()}
              value={type}
              onChange={onFilterByChange}
            />
          </Field>
          <Field label={t('grafana-datasource.annotation-query-editor.label-max-limit', 'Max limit')}>
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
              <Field
                label={t('grafana-datasource.annotation-query-editor.label-match-any', 'Match any')}
                description={t(
                  'grafana-datasource.annotation-query-editor.description-match-any',
                  'Enabling this returns annotations that match any of the tags specified below'
                )}
              >
                <Switch id="grafana-annotations__match-any" value={matchAny} onChange={onMatchAnyChange} />
              </Field>
              <Field
                label={t('grafana-datasource.annotation-query-editor.label-tags', 'Tags')}
                description={
                  <div>
                    <Trans i18nKey="grafana-datasource.annotation-query-editor.description-tags">
                      Specify a list of tags to match. To specify a key and value tag use `key:value` syntax.
                    </Trans>
                  </div>
                }
              >
                <TagFilter
                  allowCustomValue
                  inputId="grafana-annotations__tags"
                  onChange={onTagsChange}
                  tagOptions={annotationServer().tags}
                  tags={tags ?? []}
                />
              </Field>
            </>
          )}
        </>
      )}
      {grafanaQueryType === GrafanaQueryType.TimeRegions && annotationQuery.timeRegion && (
        <TimeRegionEditor value={annotationQuery.timeRegion} onChange={onTimeRegionChange} />
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

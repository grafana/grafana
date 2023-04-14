import { css } from '@emotion/css';
import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Field, FieldSet, Select, Switch } from '@grafana/ui';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { getAnnotationTags } from 'app/features/annotations/api';

import { GrafanaAnnotationQuery, GrafanaAnnotationType, GrafanaQuery } from '../types';

const matchTooltipContent = 'Enabling this returns annotations that match any of the tags specified below';

const tagsTooltipContent = (
  <div>Specify a list of tags to match. To specify a key and value tag use `key:value` syntax.</div>
);

const annotationTypes = [
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
  const { limit, matchAny, tags, type } = annotationQuery;
  const styles = getStyles();

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

  return (
    <FieldSet className={styles.container}>
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
    </FieldSet>
  );
}

const getStyles = () => {
  return {
    container: css`
      max-width: 600px;
    `,
  };
};

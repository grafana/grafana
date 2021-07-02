import React from 'react';
import { SelectableValue } from '@grafana/data';
import { FieldSet, InlineField, InlineFieldRow, InlineSwitch, Select } from '@grafana/ui';
import { css } from '@emotion/css';

import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { GrafanaAnnotationQuery, GrafanaAnnotationType, GrafanaQuery } from '../types';
import { getAnnotationTags } from 'app/features/annotations/api';

const filterTooltipContent = (
  <ul>
    <li>
      Dashboard: This will fetch annotation and alert state changes for whole dashboard and show them only on the event
      {"'"}s originating panel.
    </li>
    <li>Tags: This will fetch any annotation events that match the tags filter.</li>
  </ul>
);

const matchTooltipContent =
  'By default Grafana only shows annotations that match all tags in the query. Enabling this returns annotations that match any of the tags in the query.';

const tagsTooltipContent = (
  <div>
    A tag entered here as {"'"}foo{"'"} will match
    <ul>
      <li>
        annotation tags {"'"}foo{"'"}
      </li>
      <li>
        annotation key-value tags formatted as {"'"}foo:bar{"'"}
      </li>
    </ul>
  </div>
);

const annotationTypes = [
  { label: 'Dashboard', value: GrafanaAnnotationType.Dashboard },
  { label: 'Tags', value: GrafanaAnnotationType.Tags },
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
    <FieldSet>
      <InlineFieldRow>
        <InlineField label="Filter by" labelWidth={18} tooltip={filterTooltipContent}>
          <Select
            inputId="grafana-annotations__filter-by"
            width={16}
            options={annotationTypes}
            value={type}
            onChange={onFilterByChange}
          />
        </InlineField>
        <InlineField label="Max limit">
          <Select
            inputId="grafana-annotations__limit"
            width={16}
            options={limitOptions}
            value={limit}
            onChange={onMaxLimitChange}
          />
        </InlineField>
      </InlineFieldRow>
      {type === GrafanaAnnotationType.Tags && tags && (
        <InlineFieldRow>
          <InlineField label="Match any" labelWidth={18} tooltip={matchTooltipContent}>
            <InlineSwitch id="grafana-annotations__match-any" value={matchAny} onChange={onMatchAnyChange} />
          </InlineField>
          <InlineField
            className={styles.tagFilterContainer}
            label="Tags"
            labelWidth="auto"
            tooltip={tagsTooltipContent}
          >
            <TagFilter
              inputId="grafana-annotations__tags"
              onChange={onTagsChange}
              tagOptions={getAnnotationTags}
              tags={tags}
            />
          </InlineField>
        </InlineFieldRow>
      )}
    </FieldSet>
  );
}

const getStyles = () => {
  return {
    tagFilterContainer: css`
      max-width: 100%;
    `,
  };
};

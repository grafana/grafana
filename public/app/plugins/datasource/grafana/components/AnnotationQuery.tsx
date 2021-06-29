import React from 'react';
import { InlineField, InlineFieldRow, InlineSwitch, Select } from '@grafana/ui';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { SelectableValue } from '@grafana/data';
import { GrafanaAnnotationQuery, GrafanaAnnotationType } from '../types';
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
  query: GrafanaAnnotationQuery;
  onChange: (newValue: GrafanaAnnotationQuery) => void;
}

export default function AnnotationQuery({ query, onChange }: Props) {
  const { limit = 100, matchAny = false, tags = [], type = GrafanaAnnotationType.Tags } = query;

  const onFilterByChange = (newValue: SelectableValue<GrafanaAnnotationType>) =>
    onChange({
      ...query,
      type: newValue.value!,
    });

  const onMaxLimitChange = (newValue: SelectableValue<number>) =>
    onChange({
      ...query,
      limit: newValue.value!,
    });

  const onMatchAnyChange = (newValue: React.ChangeEvent<HTMLInputElement>) =>
    onChange({
      ...query,
      matchAny: newValue.target.checked,
    });

  const onTagsChange = (tags: string[]) =>
    onChange({
      ...query,
      tags,
    });

  return (
    <div className="gf-form-group">
      <InlineFieldRow>
        <InlineField label="Filter by" labelWidth={18} tooltip={filterTooltipContent}>
          <Select width={16} options={annotationTypes} value={type} onChange={onFilterByChange} />
        </InlineField>
        <InlineField label="Max limit">
          <Select width={16} options={limitOptions} value={limit} onChange={onMaxLimitChange} />
        </InlineField>
      </InlineFieldRow>
      {type === GrafanaAnnotationType.Tags && (
        <InlineFieldRow>
          <InlineField label="Match any" labelWidth={18} tooltip={matchTooltipContent}>
            <InlineSwitch value={matchAny} onChange={onMatchAnyChange} />
          </InlineField>
          <InlineField label="Tags" labelWidth="auto" tooltip={tagsTooltipContent}>
            <TagFilter onChange={onTagsChange} tagOptions={getAnnotationTags} tags={tags} />
          </InlineField>
        </InlineFieldRow>
      )}
    </div>
  );
}

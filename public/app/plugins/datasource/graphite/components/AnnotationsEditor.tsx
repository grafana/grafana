import React, { useState } from 'react';

import { QueryEditorProps } from '@grafana/data';
import { InlineFormLabel, Input, TagsInput } from '@grafana/ui';

import { GraphiteQuery, GraphiteEventsQuery, GraphiteOptions } from '../types';

import { GraphiteDatasource } from './../datasource';

export const AnnotationEditor = (props: QueryEditorProps<GraphiteDatasource, GraphiteQuery, GraphiteOptions>) => {
  const { query, onChange } = props;
  const [target, setTarget] = useState<string>(query?.eventsQuery?.target || '');
  const [tags, setTags] = useState<string[]>(query?.eventsQuery?.tags || []);
  const updateValue = <K extends keyof GraphiteEventsQuery, V extends GraphiteEventsQuery[K]>(key: K, val: V) => {
    onChange({
      ...query,
      queryType: 'events',
      eventsQuery: { ...query?.eventsQuery, [key]: val, fromAnnotations: true },
    });
  };

  const onTagsChange = (tagsInput: string[]) => {
    setTags(tagsInput);
    updateValue('tags', tagsInput);
  };

  return (
    <div className="gf-form-group">
      <div className="gf-form">
        <InlineFormLabel width={12}>Graphite Query</InlineFormLabel>
        <Input
          value={target || ''}
          onChange={(e) => setTarget(e.currentTarget.value || '')}
          onBlur={() => updateValue('target', target)}
          placeholder="Example: statsd.application.counters.*.count"
        />
      </div>

      <h5 className="section-heading">Or</h5>

      <div className="gf-form">
        <InlineFormLabel width={12}>Graphite events tags</InlineFormLabel>
        <TagsInput id="tags-input" tags={tags} onChange={onTagsChange} placeholder="Example: event_tag" />
      </div>
    </div>
  );
};

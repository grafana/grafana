import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2, QueryEditorProps } from '@grafana/data';
import { Box, InlineField, Input, TagsInput, useStyles2 } from '@grafana/ui';

import { GraphiteDatasource } from '../datasource';
import { GraphiteQuery, GraphiteOptions } from '../types';

export const AnnotationEditor = (props: QueryEditorProps<GraphiteDatasource, GraphiteQuery, GraphiteOptions>) => {
  const { query, onChange } = props;
  const [target, setTarget] = useState<string>(query.target ?? '');
  const [tags, setTags] = useState<string[]>(query.tags ?? []);
  const updateValue = <K extends keyof GraphiteQuery, V extends GraphiteQuery[K]>(key: K, val: V) => {
    if (key === 'tags') {
      onChange({
        ...query,
        [key]: val,
        fromAnnotations: true,
        queryType: key,
      });
    } else {
      onChange({
        ...query,
        [key]: val,
        fromAnnotations: true,
        textEditor: true,
      });
    }
  };

  const onTagsChange = (tagsInput: string[]) => {
    setTags(tagsInput);
    updateValue('tags', tagsInput);
  };
  const styles = useStyles2(getStyles);

  return (
    <Box marginBottom={5}>
      <InlineField label="Graphite Query" labelWidth={24} grow>
        <Input
          value={target}
          onChange={(e) => setTarget(e.currentTarget.value || '')}
          onBlur={() => updateValue('target', target)}
          placeholder="Example: statsd.application.counters.*.count"
        />
      </InlineField>

      <h5 className={styles.heading}>Or</h5>

      <InlineField label="Graphite events tags" labelWidth={24}>
        <TagsInput id="tags-input" width={50} tags={tags} onChange={onTagsChange} placeholder="Example: event_tag" />
      </InlineField>
    </Box>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css({
    fontSize: theme.typography.body.fontSize,
    marginBottom: theme.spacing(1),
  }),
});

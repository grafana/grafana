import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2, StandardEditorProps, toOption } from '@grafana/data';
import { IconButton, Field, useStyles2, Select } from '@grafana/ui';

import { newTagFilter, Tag } from '../../../features/explore/TraceView/useSearch';
import { getTraceTagKeys, getTraceTagValues } from '../../../features/explore/TraceView/utils/tags';
import { transformDataFrames } from '../../../features/explore/TraceView/utils/transform';

type Props = StandardEditorProps<Tag[], unknown, Tag[]>;

export const TagsEditor = ({ value, onChange, context }: Props) => {
  const styles = useStyles2(getStyles);

  const trace = useMemo(() => transformDataFrames(context.data[0]), [context.data]);
  const tagKeys = useMemo(() => (trace ? getTraceTagKeys(trace).map(toOption) : []), [trace]);
  const operators = [toOption('='), toOption('!='), toOption('=~'), toOption('!~')];

  if (!value || value.length < 1) {
    value = [newTagFilter()];
  }

  const addTag = () => {
    onChange([...value, newTagFilter()]);
  };

  const removeTag = (idx: number) => {
    const copy = value.slice();
    copy.splice(idx, 1);
    onChange(copy);
  };

  const setKey = (idx: number, key?: string) => {
    const copy = value.slice();
    copy[idx].key = key;
    copy[idx].value = undefined;
    if (copy.length === 0) {
      onChange(undefined);
    } else {
      onChange(copy);
    }
  };

  const setOperator = (idx: number, operator?: string) => {
    const copy = value.slice();
    copy[idx].operator = operator ?? '=';
    if (copy.length === 0) {
      onChange(undefined);
    } else {
      onChange(copy);
    }
  };

  const setValue = (idx: number, val?: string) => {
    const copy = value.slice();
    copy[idx].value = val;
    if (copy.length === 0) {
      onChange(undefined);
    } else {
      onChange(copy);
    }
  };

  return (
    <ul className={styles.list}>
      {value.map((tag, idx) => (
        <li key={`${idx}.${tag.id}`}>
          <div className={styles.listItem}>
            <Field label={'Key'} style={{ width: '40%' }}>
              <Select
                id={`tag-key-${tag.id}`}
                onChange={(v) => setKey(idx, v.value)}
                value={tag.key}
                options={tagKeys}
                allowCustomValue
              />
            </Field>
            <Field label={'Op'} style={{ width: '20%' }}>
              <Select
                id={`tag-op-${tag.id}`}
                onChange={(v) => setOperator(idx, v.value)}
                value={tag.operator}
                defaultValue={tag.operator}
                options={operators}
              />
            </Field>
            <Field label={'Value'} style={{ width: '40%' }}>
              <Select
                id={`tag-value-${tag.id}`}
                onChange={(v) => setValue(idx, v.value)}
                value={tag.value}
                options={trace && tag.key ? getTraceTagValues(trace, tag.key).map(toOption) : []}
                allowCustomValue
              />
            </Field>
            <IconButton name="times" onClick={() => removeTag(idx)} tooltip="Remove tag" />
          </div>
        </li>
      ))}
      <IconButton name="plus" onClick={addTag} tooltip="Add tag" />
    </ul>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  listItem: css({
    display: 'flex',
    gap: theme.spacing(1),
  }),
});

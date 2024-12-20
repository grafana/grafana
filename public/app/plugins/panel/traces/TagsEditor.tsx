import { css } from '@emotion/css';

import { GrafanaTheme2, InternalTimeZones, StandardEditorProps } from '@grafana/data';
import { IconButton, Field, Input, useStyles2 } from '@grafana/ui';

import { defaultTagFilter, Tag } from '../../../features/explore/TraceView/useSearch';

type Props = StandardEditorProps<Tag[], unknown, Tag[]>;

export const TagsEditor = ({ value, onChange }: Props) => {
  const styles = useStyles2(getStyles);

  if (!value || value.length < 1) {
    value = [defaultTagFilter];
  }

  const addTag = () => {
    onChange([...value, defaultTagFilter]);
  };

  const removeTag = (idx: number) => {
    const copy = value.slice();
    copy.splice(idx, 1);
    onChange(copy);
  };

  const setKey = (idx: number, key?: string) => {
    console.log('setKey', idx, key);
    const copy = value.slice();
    copy[idx].key = key ?? InternalTimeZones.default;
    if (copy.length === 0 || (copy.length === 1 && copy[0] === defaultTagFilter)) {
      onChange(undefined);
    } else {
      onChange(copy);
    }
  };

  return (
    <ul className={styles.list}>
      {value.map((tag, idx) => (
        <li className={styles.listItem} key={`${idx}.${tag.id}`}>
          <Field label={'Key'}>
            <Input id="tag-key" type={'text'} onChange={(v) => setKey(idx, v.currentTarget.value)} value={tag.key} />
          </Field>
          {idx === value.length - 1 ? (
            <IconButton name="plus" onClick={addTag} tooltip="Add timezone" />
          ) : (
            <IconButton name="times" onClick={() => removeTag(idx)} tooltip="Remove timezone" />
          )}
        </li>
      ))}
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

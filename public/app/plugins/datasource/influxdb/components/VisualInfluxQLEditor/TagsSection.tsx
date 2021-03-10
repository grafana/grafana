import React, { FC } from 'react';
import { SegmentAsync, Segment, HorizontalGroup, InlineFormLabel } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { InfluxQueryTag } from '../../types';

type KnownOperator = '=' | '!=' | '<>' | '<' | '>' | '=~' | '!~';
const knownOperators: KnownOperator[] = ['=', '!=', '<>', '<', '>', '=~', '!~'];

type KnownCondition = 'AND' | 'OR';
const knownConditions: KnownCondition[] = ['AND', 'OR'];

function makeSimpleOption<T extends string>(t: T): SelectableValue<T> {
  return { label: t, value: t };
}

const operatorOptions: Array<SelectableValue<KnownOperator>> = knownOperators.map(makeSimpleOption);
const condititonOptions: Array<SelectableValue<KnownCondition>> = knownConditions.map(makeSimpleOption);

type Props = {
  tags: InfluxQueryTag[];
  onChange: (tags: InfluxQueryTag[]) => void;
  getTagKeys: () => Promise<string[]>;
  getTagValuesForKey: (key: string) => Promise<string[]>;
};

type TagProps = {
  tag: InfluxQueryTag;
  isFirst: boolean;
  onRemove: () => void;
  onChange: (tag: InfluxQueryTag) => void;
  getTagKeys: () => Promise<string[]>;
  getTagValuesForKey: (key: string) => Promise<string[]>;
};

function isRegex(text: string): boolean {
  return /^\/.*\/$/.test(text);
}

// FIXME: sync these to the query-string-generation-code
// probably it's in influx_query_model.ts
function getOperator(tag: InfluxQueryTag): string {
  return tag.operator ?? (isRegex(tag.value) ? '=~' : '=');
}

// FIXME: sync these to the query-string-generation-code
// probably it's in influx_query_model.ts
function getCondition(tag: InfluxQueryTag, isFirst: boolean): string | undefined {
  return isFirst ? undefined : tag.condition ?? 'AND';
}

const Tag: FC<TagProps> = ({ tag, isFirst, onRemove, onChange, getTagKeys, getTagValuesForKey }) => {
  const operator = getOperator(tag);
  const condition = getCondition(tag, isFirst);

  const getTagKeyOptions = () => {
    return getTagKeys().then((tags) => tags.map(makeSimpleOption));
  };

  const getTagValuesOptions = () => {
    return getTagValuesForKey(tag.key).then((tags) => tags.map(makeSimpleOption));
  };

  return (
    <HorizontalGroup>
      {condition != null && (
        <Segment
          value={condition}
          options={condititonOptions}
          onChange={(v) => {
            onChange({ ...tag, condition: v.value });
            //FIXME
          }}
        />
      )}
      <SegmentAsync
        value={tag.key}
        loadOptions={getTagKeyOptions}
        onChange={(v) => {
          onChange({ ...tag, key: v.value ?? '' });
        }}
      />
      <Segment
        value={operator}
        options={operatorOptions}
        onChange={(op) => {
          onChange({ ...tag, operator: op.value });
        }}
      />
      <SegmentAsync
        value={tag.value}
        loadOptions={getTagValuesOptions}
        onChange={(v) => {
          onChange({ ...tag, value: v.value ?? '' });
        }}
      />
      <input type="button" value="X" onClick={onRemove} />
    </HorizontalGroup>
  );
};

export const TagsSection: FC<Props> = ({ tags, onChange, getTagKeys, getTagValuesForKey }) => {
  const onTagChange = (newTag: InfluxQueryTag, index: number) => {
    const newTags = tags.map((tag, i) => {
      return index === i ? newTag : tag;
    });
    onChange(newTags);
  };

  const onTagRemove = (index: number) => {
    const newTags = tags.filter((t, i) => i !== index);
    onChange(newTags);
  };

  const getTagKeyOptions = () => {
    return getTagKeys().then((tags) => tags.map(makeSimpleOption));
  };

  const addNewTag = (tagKey: string, isFirst: boolean) => {
    const minimalTag: InfluxQueryTag = {
      key: tagKey,
      value: 'select tag value',
    };

    const newTag: InfluxQueryTag = {
      key: minimalTag.key,
      value: minimalTag.value,
      operator: getOperator(minimalTag),
      condition: getCondition(minimalTag, isFirst),
    };

    onChange([...tags, newTag]);
  };

  return (
    <HorizontalGroup>
      <InlineFormLabel>Where</InlineFormLabel>
      {tags.map((t, i) => (
        <Tag
          tag={t}
          isFirst={i === 0}
          key={i.toString()}
          onChange={(newT) => {
            onTagChange(newT, i);
          }}
          onRemove={() => {
            onTagRemove(i);
          }}
          getTagKeys={getTagKeys}
          getTagValuesForKey={getTagValuesForKey}
        />
      ))}
      <SegmentAsync
        value="+"
        loadOptions={getTagKeyOptions}
        onChange={(v) => {
          addNewTag(v.value ?? '', tags.length === 0);
        }}
      />
    </HorizontalGroup>
  );
};

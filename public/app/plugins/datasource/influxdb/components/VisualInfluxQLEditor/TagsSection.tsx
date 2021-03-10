import React from 'react';
import { SegmentAsync, Segment } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { InfluxQueryTag } from '../../types';
import { toSelectableValue } from './toSelectableValue';

type KnownOperator = '=' | '!=' | '<>' | '<' | '>' | '=~' | '!~';
const knownOperators: KnownOperator[] = ['=', '!=', '<>', '<', '>', '=~', '!~'];

type KnownCondition = 'AND' | 'OR';
const knownConditions: KnownCondition[] = ['AND', 'OR'];

const operatorOptions: Array<SelectableValue<KnownOperator>> = knownOperators.map(toSelectableValue);
const condititonOptions: Array<SelectableValue<KnownCondition>> = knownConditions.map(toSelectableValue);

type Props = {
  tags: InfluxQueryTag[];
  onChange: (tags: InfluxQueryTag[]) => void;
  getTagKeyOptions: () => Promise<string[]>;
  getTagValueOptions: (key: string) => Promise<string[]>;
};

type TagProps = {
  tag: InfluxQueryTag;
  isFirst: boolean;
  onRemove: () => void;
  onChange: (tag: InfluxQueryTag) => void;
  getTagKeyOptions: () => Promise<string[]>;
  getTagValueOptions: (key: string) => Promise<string[]>;
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

const Tag = ({ tag, isFirst, onRemove, onChange, getTagKeyOptions, getTagValueOptions }: TagProps): JSX.Element => {
  const operator = getOperator(tag);
  const condition = getCondition(tag, isFirst);

  const getTagKeySegmentOptions = () => {
    return getTagKeyOptions().then((tags) => [
      ...tags.map(toSelectableValue),
      { label: '-- remove filter --', value: undefined },
    ]);
  };

  const getTagValueSegmentOptions = () => {
    return getTagValueOptions(tag.key).then((tags) => tags.map(toSelectableValue));
  };

  return (
    <div className="gf-form">
      {condition != null && (
        <Segment
          value={condition}
          options={condititonOptions}
          onChange={(v) => {
            onChange({ ...tag, condition: v.value });
          }}
        />
      )}
      <SegmentAsync
        allowCustomValue
        value={tag.key}
        loadOptions={getTagKeySegmentOptions}
        onChange={(v) => {
          const { value } = v;
          if (value === undefined) {
            onRemove();
          } else {
            onChange({ ...tag, key: value ?? '' });
          }
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
        allowCustomValue
        value={tag.value}
        loadOptions={getTagValueSegmentOptions}
        onChange={(v) => {
          onChange({ ...tag, value: v.value ?? '' });
        }}
      />
    </div>
  );
};

export const TagsSection = ({ tags, onChange, getTagKeyOptions, getTagValueOptions }: Props): JSX.Element => {
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

  const getTagKeySegmentOptions = () => {
    return getTagKeyOptions().then((tags) => tags.map(toSelectableValue));
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
    <>
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
          getTagKeyOptions={getTagKeyOptions}
          getTagValueOptions={getTagValueOptions}
        />
      ))}
      <SegmentAsync
        allowCustomValue
        value="+"
        loadOptions={getTagKeySegmentOptions}
        onChange={(v) => {
          addNewTag(v.value ?? '', tags.length === 0);
        }}
      />
    </>
  );
};

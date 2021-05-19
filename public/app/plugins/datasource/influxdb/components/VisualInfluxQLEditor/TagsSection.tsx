import React from 'react';
import { SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { Seg } from './Seg';
import { InfluxQueryTag } from '../../types';
import { toSelectableValue } from './toSelectableValue';
import { adjustOperatorIfNeeded, getCondition, getOperator } from './tagUtils';
import { AddButton } from './AddButton';

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

const loadConditionOptions = () => Promise.resolve(condititonOptions);

const loadOperatorOptions = () => Promise.resolve(operatorOptions);

const getEmptyTagValueStyles = (theme: GrafanaTheme2) =>
  css({
    color: theme.colors.text.secondary,
  });

const EMPTY_TAG_VALUE_MARKER = '-- empty --';

const Tag = ({ tag, isFirst, onRemove, onChange, getTagKeyOptions, getTagValueOptions }: TagProps): JSX.Element => {
  const emptyTagClass = useStyles2(getEmptyTagValueStyles);
  const operator = getOperator(tag);
  const condition = getCondition(tag, isFirst);

  const getTagKeySegmentOptions = () => {
    return getTagKeyOptions().then((tags) => [
      { label: '-- remove filter --', value: undefined },
      ...tags.map(toSelectableValue),
    ]);
  };

  const getTagValueSegmentOptions = () => {
    return getTagValueOptions(tag.key).then((tags) => [
      { label: EMPTY_TAG_VALUE_MARKER, value: undefined },
      ...tags.map(toSelectableValue),
    ]);
  };

  return (
    <div className="gf-form">
      {condition != null && (
        <Seg
          value={condition}
          loadOptions={loadConditionOptions}
          onChange={(v) => {
            onChange({ ...tag, condition: v });
          }}
        />
      )}
      <Seg
        allowCustomValue
        value={tag.key}
        loadOptions={getTagKeySegmentOptions}
        onChange={(v) => {
          if (v === undefined) {
            onRemove();
          } else {
            onChange({ ...tag, key: v });
          }
        }}
      />
      <Seg
        value={operator}
        loadOptions={loadOperatorOptions}
        onChange={(op) => {
          onChange({ ...tag, operator: op });
        }}
      />
      <Seg
        allowCustomValue
        value={tag.value === '' ? EMPTY_TAG_VALUE_MARKER : tag.value}
        buttonClassName={tag.value === '' ? emptyTagClass : undefined}
        loadOptions={getTagValueSegmentOptions}
        onChange={(v) => {
          const value = v ?? '';
          onChange({ ...tag, value, operator: adjustOperatorIfNeeded(operator, value) });
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
      value: '',
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
          key={i}
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
      <AddButton
        allowCustomValue
        loadOptions={getTagKeySegmentOptions}
        onAdd={(v) => {
          addNewTag(v, tags.length === 0);
        }}
      />
    </>
  );
};

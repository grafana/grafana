import React, { FC } from 'react';
import { SegmentAsync, Segment, SegmentInput, HorizontalGroup, InlineFormLabel } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { unwrap } from './unwrap';

type PartParams = Array<{
  value: string;
  options: (() => Promise<string[]>) | null;
}>;

type Props = {
  name: string;
  parts: Array<{
    name: string;
    params: PartParams;
  }>;
  newPartOptions: SelectableValue[];
  onChange: (partIndex: number, paramValues: string[]) => void;
  onRemovePart: (index: number) => void;
  onAddNewPart: (type: string) => void;
};

type PartProps = {
  name: string;
  params: PartParams;
  onRemove: () => void;
  onChange: (paramValues: string[]) => void;
};

function makeSimpleOption<T extends string>(t: T): SelectableValue<T> {
  return { label: t, value: t };
}

const Part: FC<PartProps> = ({ name, params, onChange, onRemove }) => {
  const onParamChange = (par: string, i: number) => {
    const newParams = params.map((p) => p.value);
    newParams[i] = par;
    onChange(newParams);
  };
  // FIXME: parts with no options look a little strange,
  // maybe special-case it and do not use segmentasync there?
  return (
    <HorizontalGroup>
      {name}
      {params.map((p, i) => {
        const { value, options } = p;
        return options != null ? (
          <SegmentAsync
            key={i.toString()}
            value={value}
            loadOptions={() => options().then((items) => items.map(makeSimpleOption))}
            onChange={(v) => {
              onParamChange(unwrap(v.value), i);
            }}
          />
        ) : (
          <SegmentInput
            key={i.toString()}
            value={value}
            onChange={(v) => {
              onParamChange(v.toString(), i);
            }}
          />
        );
      })}
      <input type="button" value="X" onClick={onRemove} />
    </HorizontalGroup>
  );
};

export const PartListSection: FC<Props> = ({ name, parts, newPartOptions, onAddNewPart, onRemovePart, onChange }) => {
  return (
    <HorizontalGroup>
      <InlineFormLabel>{name}</InlineFormLabel>
      {parts.map((part, index) => (
        <Part
          key={index.toString()}
          name={part.name}
          params={part.params}
          onRemove={() => {
            onRemovePart(index);
          }}
          onChange={(pars) => {
            onChange(index, pars);
          }}
        />
      ))}
      <Segment<string>
        value="+"
        options={newPartOptions}
        onChange={(v) => {
          onAddNewPart(unwrap(v.value));
        }}
      />
    </HorizontalGroup>
  );
};

import React, { useMemo } from 'react';

import { PluginState, SelectableValue, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { getDistinctLabels } from '../utils';

import { joinByLabelsTransformer, JoinByLabelsTransformOptions } from './joinByLabels';

export interface Props extends TransformerUIProps<JoinByLabelsTransformOptions> {}

export function JoinByLabelsTransformerEditor({ input, options, onChange }: Props) {
  const info = useMemo(() => {
    const distinct = getDistinctLabels(input);
    const valueOptions = Array.from(distinct).map((value) => ({ label: value, value }));
    let valueOption = valueOptions.find((v) => v.value === options.value);
    if (!valueOption && options.value) {
      valueOption = { label: `${options.value} (not found)`, value: options.value };
      valueOptions.push(valueOption);
    }

    // Show the selected values
    distinct.delete(options.value);
    const joinOptions = Array.from(distinct).map((value) => ({ label: value, value }));

    let addOptions = joinOptions;
    const hasJoin = Boolean(options.join?.length);
    let addText = 'Join';
    if (hasJoin) {
      addOptions = joinOptions.filter((v) => !options.join!.includes(v.value));
    } else {
      addText = joinOptions.map((v) => v.value).join(', '); // all the fields
    }

    return { valueOptions, valueOption, joinOptions, addOptions, addText, hasJoin, key: Date.now() };
  }, [options, input]);

  const updateJoinValue = (idx: number, value?: string) => {
    if (!options.join) {
      return; // nothing to do
    }
    const join = options.join.slice();
    if (!value) {
      join.splice(idx, 1);
      if (!join.length) {
        onChange({ ...options, join: undefined });
        return;
      }
    } else {
      join[idx] = value;
    }
    onChange({ ...options, join });
  };

  const addJoin = (sel: SelectableValue<string>) => {
    const v = sel?.value;
    if (!v) {
      return;
    }
    const join = options.join ? options.join.slice() : [];
    join.push(v);
    onChange({ ...options, join });
  };

  if (input.length === 0) {
    return null;
  }

  const labelWidth = 10;

  return (
    <div>
      <InlineFieldRow>
        <InlineField
          error="required"
          invalid={!Boolean(options.value?.length)}
          label={'Value'}
          labelWidth={labelWidth}
          tooltip="Select the label indicating the values name"
        >
          <Select
            options={info.valueOptions}
            value={info.valueOption}
            onChange={(v) => onChange({ ...options, value: v.value! })}
          />
        </InlineField>
      </InlineFieldRow>
      {info.hasJoin &&
        options.join!.map((v, idx) => (
          <InlineFieldRow key={v + idx}>
            <InlineField
              label={'Join'}
              labelWidth={labelWidth}
              error="Unable to join by the value label"
              invalid={v === options.value}
            >
              <Select
                options={info.joinOptions}
                value={info.joinOptions.find((o) => o.value === v)}
                isClearable={true}
                onChange={(v) => updateJoinValue(idx, v?.value)}
              />
            </InlineField>
          </InlineFieldRow>
        ))}
      {Boolean(info.addOptions.length) && (
        <InlineFieldRow>
          <InlineField label={info.hasJoin ? '' : 'Join'} labelWidth={labelWidth}>
            <Select key={info.key} options={info.addOptions} placeholder={info.addText} onChange={addJoin} />
          </InlineField>
        </InlineFieldRow>
      )}
    </div>
  );
}

export const joinByLabelsTransformRegistryItem: TransformerRegistryItem<JoinByLabelsTransformOptions> = {
  id: joinByLabelsTransformer.id,
  editor: JoinByLabelsTransformerEditor,
  transformation: joinByLabelsTransformer,
  name: joinByLabelsTransformer.name,
  description: joinByLabelsTransformer.description,
  state: PluginState.beta,
  //   help: `
  // ### Use cases

  // This transforms labeled results into a table
  // `,
};

import { useMemo } from 'react';
import * as React from 'react';

import {
  PluginState,
  SelectableValue,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { Alert, HorizontalGroup, InlineField, InlineFieldRow, Select, ValuePicker } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { getTransformationContent } from '../docs/getTransformationContent';
import { getDistinctLabels } from '../utils';

import { joinByLabelsTransformer, JoinByLabelsTransformOptions } from './joinByLabels';

export interface Props extends TransformerUIProps<JoinByLabelsTransformOptions> {}

export function JoinByLabelsTransformerEditor({ input, options, onChange }: Props) {
  const info = useMemo(() => {
    let warn: React.ReactNode = undefined;
    const distinct = getDistinctLabels(input);
    const valueOptions = Array.from(distinct).map((value) => ({ label: value, value }));
    let valueOption = valueOptions.find((v) => v.value === options.value);
    if (!valueOption && options.value) {
      valueOption = { label: `${options.value} (not found)`, value: options.value };
      valueOptions.push(valueOption);
    }

    if (!input.length) {
      warn = (
        <Alert title={t('transformers.join-by-labels-transformer-editor.info.title-no-input-found', 'No input found')}>
          <Trans i18nKey="transformers.join-by-labels-transformer-editor.info.no-input-or-labels-found">
            No input (or labels) found
          </Trans>
        </Alert>
      );
    } else if (distinct.size === 0) {
      warn = (
        <Alert
          title={t('transformers.join-by-labels-transformer-editor.info.title-no-labels-found', 'No labels found')}
        >
          <Trans i18nKey="transformers.join-by-labels-transformer-editor.info.input-contain-labels">
            The input does not contain any labels
          </Trans>
        </Alert>
      );
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

    return { warn, valueOptions, valueOption, joinOptions, addOptions, addText, hasJoin, key: Date.now() };
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

    // Remove duplicates and the value field
    const t = new Set(join);
    if (options.value) {
      t.delete(options.value);
    }
    onChange({ ...options, join: Array.from(t) });
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

  const labelWidth = 10;
  const noOptionsMessage = 'No labels found';

  return (
    <div>
      {info.warn}

      <InlineFieldRow>
        <InlineField
          error="required"
          invalid={!Boolean(options.value?.length)}
          label={t('transformers.join-by-labels-transformer-editor.label-value', 'Value')}
          labelWidth={labelWidth}
          tooltip={t(
            'transformers.join-by-labels-transformer-editor.tooltip-select-label-indicating-values',
            'Select the label indicating the values name'
          )}
        >
          <Select
            options={info.valueOptions}
            value={info.valueOption}
            onChange={(v) => onChange({ ...options, value: v.value! })}
            noOptionsMessage={noOptionsMessage}
          />
        </InlineField>
      </InlineFieldRow>
      {info.hasJoin ? (
        options.join!.map((v, idx) => (
          <InlineFieldRow key={v + idx}>
            <InlineField
              label={t('transformers.join-by-labels-transformer-editor.label-join', 'Join')}
              labelWidth={labelWidth}
              error="Unable to join by the value label"
              invalid={v === options.value}
            >
              <HorizontalGroup>
                <Select
                  options={info.joinOptions}
                  value={info.joinOptions.find((o) => o.value === v)}
                  isClearable={true}
                  onChange={(v) => updateJoinValue(idx, v?.value)}
                  noOptionsMessage={noOptionsMessage}
                />
                {Boolean(info.addOptions.length && idx === options.join!.length - 1) && (
                  <ValuePicker
                    icon="plus"
                    // eslint-disable-next-line @grafana/no-untranslated-strings
                    label={''}
                    options={info.addOptions}
                    onChange={addJoin}
                    variant="secondary"
                  />
                )}
              </HorizontalGroup>
            </InlineField>
          </InlineFieldRow>
        ))
      ) : (
        <>
          {Boolean(info.addOptions.length) && (
            <InlineFieldRow>
              <InlineField
                label={t('transformers.join-by-labels-transformer-editor.label-join', 'Join')}
                labelWidth={labelWidth}
              >
                <Select
                  options={info.addOptions}
                  placeholder={info.addText}
                  onChange={addJoin}
                  noOptionsMessage={noOptionsMessage}
                />
              </InlineField>
            </InlineFieldRow>
          )}
        </>
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
  categories: new Set([TransformerCategory.Combine]),
  help: getTransformationContent(joinByLabelsTransformer.id).helperDocs,
};

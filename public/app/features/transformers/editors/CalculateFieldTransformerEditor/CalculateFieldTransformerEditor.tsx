import { ChangeEvent, useEffect, useState } from 'react';
import * as React from 'react';
import { identity, of, OperatorFunction } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  DataFrame,
  DataTransformerID,
  FieldType,
  getFieldDisplayName,
  KeyValue,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  FieldMatcherID,
} from '@grafana/data';
import {
  CalculateFieldMode,
  CalculateFieldTransformerOptions,
  getNameFromOptions,
  defaultWindowOptions,
} from '@grafana/data/src/transformations/transformers/calculateField';
import { getTemplateSrv, config as cfg } from '@grafana/runtime';
import { InlineField, InlineSwitch, Input, Select } from '@grafana/ui';

import { getTransformationContent } from '../../docs/getTransformationContent';

import { BinaryOperationOptionsEditor } from './BinaryOperationOptionsEditor';
import { CumulativeOptionsEditor } from './CumulativeOptionsEditor';
import { IndexOptionsEditor } from './IndexOptionsEditor';
import { ReduceRowOptionsEditor } from './ReduceRowOptionsEditor';
import { UnaryOperationEditor } from './UnaryOperationEditor';
import { WindowOptionsEditor } from './WindowOptionsEditor';
import { LABEL_WIDTH } from './constants';
interface CalculateFieldTransformerEditorProps extends TransformerUIProps<CalculateFieldTransformerOptions> {}

interface CalculateFieldTransformerEditorState {
  names: string[];
  selected: string[];
}

const calculationModes = [
  { value: CalculateFieldMode.BinaryOperation, label: 'Binary operation' },
  { value: CalculateFieldMode.UnaryOperation, label: 'Unary operation' },
  { value: CalculateFieldMode.ReduceRow, label: 'Reduce row' },
  { value: CalculateFieldMode.Index, label: 'Row index' },
];

if (cfg.featureToggles.addFieldFromCalculationStatFunctions) {
  calculationModes.push(
    { value: CalculateFieldMode.CumulativeFunctions, label: 'Cumulative functions' },
    { value: CalculateFieldMode.WindowFunctions, label: 'Window functions' }
  );
}

const okTypes = new Set<FieldType>([FieldType.time, FieldType.number, FieldType.string]);

export const CalculateFieldTransformerEditor = (props: CalculateFieldTransformerEditorProps) => {
  const { options, onChange, input } = props;
  const configuredOptions = options?.reduce?.include;

  const [state, setState] = useState<CalculateFieldTransformerEditorState>({ names: [], selected: [] });

  useEffect(() => {
    const ctx = { interpolate: (v: string) => v };
    const subscription = of(input)
      .pipe(
        standardTransformers.ensureColumnsTransformer.operator(null, ctx),
        extractAllNames(),
        getVariableNames(),
        extractNamesAndSelected(configuredOptions || [])
      )
      .subscribe(({ selected, names }) => {
        setState({ names, selected });
      });
    return () => {
      subscription.unsubscribe();
    };
  }, [input, configuredOptions]);

  const getVariableNames = (): OperatorFunction<string[], string[]> => {
    if (!cfg.featureToggles.transformationsVariableSupport) {
      return identity;
    }
    const templateSrv = getTemplateSrv();
    return (source) =>
      source.pipe(
        map((input) => {
          input.push(...templateSrv.getVariables().map((v) => '$' + v.name));
          return input;
        })
      );
  };

  const extractAllNames = (): OperatorFunction<DataFrame[], string[]> => {
    return (source) =>
      source.pipe(
        map((input) => {
          const allNames: string[] = [];
          const byName: KeyValue<boolean> = {};

          for (const frame of input) {
            for (const field of frame.fields) {
              if (!okTypes.has(field.type)) {
                continue;
              }

              const displayName = getFieldDisplayName(field, frame, input);

              if (!byName[displayName]) {
                byName[displayName] = true;
                allNames.push(displayName);
              }
            }
          }

          return allNames;
        })
      );
  };

  const extractNamesAndSelected = (
    configuredOptions: string[]
  ): OperatorFunction<string[], { names: string[]; selected: string[] }> => {
    return (source) =>
      source.pipe(
        map((allNames) => {
          if (!configuredOptions.length) {
            return { names: allNames, selected: [] };
          }

          const names: string[] = [];
          const selected: string[] = [];

          for (const v of allNames) {
            if (configuredOptions.includes(v)) {
              selected.push(v);
            }
            names.push(v);
          }

          return { names, selected };
        })
      );
  };

  const onToggleReplaceFields = (e: React.FormEvent<HTMLInputElement>) => {
    onChange({
      ...options,
      replaceFields: e.currentTarget.checked,
    });
  };

  const onModeChanged = (value: SelectableValue<CalculateFieldMode>) => {
    const mode = value.value ?? CalculateFieldMode.BinaryOperation;
    if (mode === CalculateFieldMode.WindowFunctions) {
      options.window = options.window ?? defaultWindowOptions;
    }
    onChange({
      ...options,
      mode,
    });
  };

  const onAliasChanged = (evt: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...options,
      alias: evt.target.value,
    });
  };

  const mode = options.mode ?? CalculateFieldMode.BinaryOperation;
  // For binary operation with type matching, disable alias input
  const disableAlias =
    mode === CalculateFieldMode.BinaryOperation && options.binary?.left.matcher?.id === FieldMatcherID.byType;

  return (
    <>
      <InlineField labelWidth={LABEL_WIDTH} label="Mode">
        <Select
          className="width-18"
          options={calculationModes}
          value={calculationModes.find((v) => v.value === mode)}
          onChange={onModeChanged}
        />
      </InlineField>
      {mode === CalculateFieldMode.BinaryOperation && (
        <BinaryOperationOptionsEditor
          options={options}
          names={state.names}
          onChange={props.onChange}
        ></BinaryOperationOptionsEditor>
      )}
      {mode === CalculateFieldMode.UnaryOperation && (
        <UnaryOperationEditor names={state.names} options={options} onChange={props.onChange}></UnaryOperationEditor>
      )}
      {mode === CalculateFieldMode.ReduceRow && (
        <ReduceRowOptionsEditor
          names={state.names}
          selected={state.selected}
          options={options}
          onChange={props.onChange}
        ></ReduceRowOptionsEditor>
      )}
      {mode === CalculateFieldMode.CumulativeFunctions && (
        <CumulativeOptionsEditor
          names={state.names}
          options={options}
          onChange={props.onChange}
        ></CumulativeOptionsEditor>
      )}
      {mode === CalculateFieldMode.WindowFunctions && (
        <WindowOptionsEditor names={state.names} options={options} onChange={props.onChange}></WindowOptionsEditor>
      )}
      {mode === CalculateFieldMode.Index && (
        <IndexOptionsEditor options={options} onChange={props.onChange}></IndexOptionsEditor>
      )}
      <InlineField labelWidth={LABEL_WIDTH} label="Alias" disabled={disableAlias}>
        <Input
          className="width-18"
          value={options.alias ?? ''}
          placeholder={getNameFromOptions(options)}
          onChange={onAliasChanged}
        />
      </InlineField>
      <InlineField labelWidth={LABEL_WIDTH} label="Replace all fields">
        <InlineSwitch value={!!options.replaceFields} onChange={onToggleReplaceFields} />
      </InlineField>
    </>
  );
};

export const calculateFieldTransformRegistryItem: TransformerRegistryItem<CalculateFieldTransformerOptions> = {
  id: DataTransformerID.calculateField,
  editor: CalculateFieldTransformerEditor,
  transformation: standardTransformers.calculateFieldTransformer,
  name: standardTransformers.calculateFieldTransformer.name,
  description: 'Use the row values to calculate a new field.',
  categories: new Set([TransformerCategory.CalculateNewFields]),
  help: getTransformationContent(DataTransformerID.calculateField).helperDocs,
};

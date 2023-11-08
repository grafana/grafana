import { defaults } from 'lodash';
import React, { ChangeEvent, useEffect, useState } from 'react';
import { identity, of, OperatorFunction } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  BinaryOperationID,
  binaryOperators,
  unaryOperators,
  DataFrame,
  DataTransformerID,
  FieldType,
  getFieldDisplayName,
  KeyValue,
  ReducerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  UnaryOperationID,
} from '@grafana/data';
import {
  BinaryOptions,
  UnaryOptions,
  CalculateFieldMode,
  WindowAlignment,
  CalculateFieldTransformerOptions,
  getNameFromOptions,
  IndexOptions,
  ReduceOptions,
  CumulativeOptions,
  WindowOptions,
  WindowSizeMode,
  defaultWindowOptions,
} from '@grafana/data/src/transformations/transformers/calculateField';
import { getTemplateSrv, config as cfg } from '@grafana/runtime';
import {
  FilterPill,
  HorizontalGroup,
  InlineField,
  InlineFieldRow,
  InlineLabel,
  InlineSwitch,
  Input,
  RadioButtonGroup,
  Select,
  StatsPicker,
} from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { getTransformationContent } from '../docs/getTransformationContent';

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

const labelWidth = 16;

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

  //---------------------------------------------------------
  // Row index
  //---------------------------------------------------------

  //---------------------------------------------------------
  // Binary Operator
  //---------------------------------------------------------

  const updateBinaryOptions = (v: BinaryOptions) => {
    onChange({
      ...options,
      mode: CalculateFieldMode.BinaryOperation,
      binary: v,
    });
  };

  const onBinaryLeftChanged = (v: SelectableValue<string>) => {
    const { binary } = options;
    updateBinaryOptions({
      ...binary!,
      left: v.value!,
    });
  };

  const onBinaryRightChanged = (v: SelectableValue<string>) => {
    const { binary } = options;
    updateBinaryOptions({
      ...binary!,
      right: v.value!,
    });
  };

  const onBinaryOperationChanged = (v: SelectableValue<BinaryOperationID>) => {
    const { binary } = options;
    updateBinaryOptions({
      ...binary!,
      operator: v.value!,
    });
  };

  const renderBinaryOperation = (options?: BinaryOptions) => {
    options = defaults(options, { operator: BinaryOperationID.Add });

    let foundLeft = !options?.left;
    let foundRight = !options?.right;
    const names = state.names.map((v) => {
      if (v === options?.left) {
        foundLeft = true;
      }
      if (v === options?.right) {
        foundRight = true;
      }
      return { label: v, value: v };
    });
    const leftNames = foundLeft ? names : [...names, { label: options?.left, value: options?.left }];
    const rightNames = foundRight ? names : [...names, { label: options?.right, value: options?.right }];

    const ops = binaryOperators.list().map((v) => {
      return { label: v.binaryOperationID, value: v.binaryOperationID };
    });

    return (
      <>
        <InlineFieldRow>
          <InlineField label="Operation" labelWidth={labelWidth}>
            <Select
              allowCustomValue={true}
              placeholder="Field or number"
              options={leftNames}
              className="min-width-18"
              value={options?.left}
              onChange={onBinaryLeftChanged}
            />
          </InlineField>
          <InlineField>
            <Select
              className="width-4"
              options={ops}
              value={options.operator ?? ops[0].value}
              onChange={onBinaryOperationChanged}
            />
          </InlineField>
          <InlineField>
            <Select
              allowCustomValue={true}
              placeholder="Field or number"
              className="min-width-10"
              options={rightNames}
              value={options?.right}
              onChange={onBinaryRightChanged}
            />
          </InlineField>
        </InlineFieldRow>
      </>
    );
  };

  const mode = options.mode ?? CalculateFieldMode.BinaryOperation;

  return (
    <>
      <InlineField labelWidth={labelWidth} label="Mode">
        <Select
          className="width-18"
          options={calculationModes}
          value={calculationModes.find((v) => v.value === mode)}
          onChange={onModeChanged}
        />
      </InlineField>
      {mode === CalculateFieldMode.BinaryOperation && renderBinaryOperation(options.binary)}
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
      <InlineField labelWidth={labelWidth} label="Alias">
        <Input
          className="width-18"
          value={options.alias ?? ''}
          placeholder={getNameFromOptions(options)}
          onChange={onAliasChanged}
        />
      </InlineField>
      <InlineField labelWidth={labelWidth} label="Replace all fields">
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

const WindowOptionsEditor = (props: {
  options: CalculateFieldTransformerOptions;
  names: string[];
  onChange: (options: CalculateFieldTransformerOptions) => void;
}) => {
  const { options, names, onChange } = props;
  const { window } = options;
  const selectOptions = names.map((v) => ({ label: v, value: v }));
  const typeOptions = [
    { label: 'Trailing', value: WindowAlignment.Trailing },
    { label: 'Centered', value: WindowAlignment.Centered },
  ];
  const windowSizeModeOptions = [
    { label: 'Percentage', value: WindowSizeMode.Percentage },
    { label: 'Fixed', value: WindowSizeMode.Fixed },
  ];

  const updateWindowOptions = (v: WindowOptions) => {
    onChange({
      ...options,
      mode: CalculateFieldMode.WindowFunctions,
      window: v,
    });
  };

  const onWindowFieldChange = (v: SelectableValue<string>) => {
    updateWindowOptions({
      ...window!,
      field: v.value!,
    });
  };

  const onWindowSizeChange = (v?: number) => {
    updateWindowOptions({
      ...window!,
      windowSize: v && window?.windowSizeMode === WindowSizeMode.Percentage ? v / 100 : v,
    });
  };

  const onWindowSizeModeChange = (val: string) => {
    const mode = val as WindowSizeMode;
    updateWindowOptions({
      ...window!,
      windowSize: window?.windowSize
        ? mode === WindowSizeMode.Percentage
          ? window!.windowSize! / 100
          : window!.windowSize! * 100
        : undefined,
      windowSizeMode: mode,
    });
  };

  const onWindowStatsChange = (stats: string[]) => {
    const reducer = stats.length ? (stats[0] as ReducerID) : ReducerID.sum;

    updateWindowOptions({ ...window, reducer });
  };

  const onTypeChange = (val: string) => {
    updateWindowOptions({
      ...window!,
      windowAlignment: val as WindowAlignment,
    });
  };

  return (
    <>
      <InlineField label="Field" labelWidth={labelWidth}>
        <Select
          placeholder="Field"
          options={selectOptions}
          className="min-width-18"
          value={window?.field}
          onChange={onWindowFieldChange}
        />
      </InlineField>
      <InlineField label="Calculation" labelWidth={labelWidth}>
        <StatsPicker
          allowMultiple={false}
          className="width-18"
          stats={[window?.reducer || ReducerID.mean]}
          onChange={onWindowStatsChange}
          defaultStat={ReducerID.mean}
          filterOptions={(ext) =>
            ext.id === ReducerID.mean || ext.id === ReducerID.variance || ext.id === ReducerID.stdDev
          }
        />
      </InlineField>
      <InlineField label="Type" labelWidth={labelWidth}>
        <RadioButtonGroup
          value={window?.windowAlignment ?? WindowAlignment.Trailing}
          options={typeOptions}
          onChange={onTypeChange}
        />
      </InlineField>
      <InlineField label="Window size mode">
        <RadioButtonGroup
          value={window?.windowSizeMode ?? WindowSizeMode.Percentage}
          options={windowSizeModeOptions}
          onChange={onWindowSizeModeChange}
        ></RadioButtonGroup>
      </InlineField>
      <InlineField
        label={window?.windowSizeMode === WindowSizeMode.Percentage ? 'Window size %' : 'Window size'}
        labelWidth={labelWidth}
        tooltip={
          window?.windowSizeMode === WindowSizeMode.Percentage
            ? 'Set the window size as a percentage of the total data'
            : 'Window size'
        }
      >
        <NumberInput
          placeholder="Auto"
          min={0.1}
          value={
            window?.windowSize && window.windowSizeMode === WindowSizeMode.Percentage
              ? window.windowSize * 100
              : window?.windowSize
          }
          onChange={onWindowSizeChange}
        ></NumberInput>
      </InlineField>
    </>
  );
};

const CumulativeOptionsEditor = (props: {
  options: CalculateFieldTransformerOptions;
  names: string[];
  onChange: (options: CalculateFieldTransformerOptions) => void;
}) => {
  const { names, onChange, options } = props;
  const { cumulative } = options;
  const selectOptions = names.map((v) => ({ label: v, value: v }));

  const onCumulativeStatsChange = (stats: string[]) => {
    const reducer = stats.length ? (stats[0] as ReducerID) : ReducerID.sum;

    updateCumulativeOptions({ ...cumulative, reducer });
  };

  const updateCumulativeOptions = (v: CumulativeOptions) => {
    onChange({
      ...options,
      mode: CalculateFieldMode.CumulativeFunctions,
      cumulative: v,
    });
  };

  const onCumulativeFieldChange = (v: SelectableValue<string>) => {
    updateCumulativeOptions({
      ...cumulative!,
      field: v.value!,
    });
  };

  return (
    <>
      <InlineField label="Field" labelWidth={labelWidth}>
        <Select
          placeholder="Field"
          options={selectOptions}
          className="min-width-18"
          value={cumulative?.field}
          onChange={onCumulativeFieldChange}
        />
      </InlineField>
      <InlineField label="Calculation" labelWidth={labelWidth}>
        <StatsPicker
          allowMultiple={false}
          className="width-18"
          stats={[cumulative?.reducer || ReducerID.sum]}
          onChange={onCumulativeStatsChange}
          defaultStat={ReducerID.sum}
          filterOptions={(ext) => ext.id === ReducerID.sum || ext.id === ReducerID.mean}
        />
      </InlineField>
    </>
  );
};

const ReduceRowOptionsEditor = (props: {
  options: CalculateFieldTransformerOptions;
  names: string[];
  selected: string[];
  onChange: (options: CalculateFieldTransformerOptions) => void;
}) => {
  const { names, selected, onChange, options } = props;
  const { reduce } = options;

  const updateReduceOptions = (v: ReduceOptions) => {
    onChange({
      ...options,
      reduce: v,
    });
  };

  const onFieldToggle = (fieldName: string) => {
    if (selected.indexOf(fieldName) > -1) {
      onReduceFieldsChanged(selected.filter((s) => s !== fieldName));
    } else {
      onReduceFieldsChanged([...selected, fieldName]);
    }
  };

  const onReduceFieldsChanged = (selected: string[]) => {
    updateReduceOptions({
      ...reduce!,
      include: selected,
    });
  };

  const onStatsChange = (stats: string[]) => {
    const reducer = stats.length ? (stats[0] as ReducerID) : ReducerID.sum;

    const { reduce } = options;
    updateReduceOptions({ ...reduce, reducer });
  };

  return (
    <>
      <InlineField label="Operation" labelWidth={labelWidth} grow={true}>
        <HorizontalGroup spacing="xs" align="flex-start" wrap>
          {names.map((o, i) => {
            return (
              <FilterPill
                key={`${o}/${i}`}
                onClick={() => {
                  onFieldToggle(o);
                }}
                label={o}
                selected={selected.indexOf(o) > -1}
              />
            );
          })}
        </HorizontalGroup>
      </InlineField>
      <InlineField label="Calculation" labelWidth={labelWidth}>
        <StatsPicker
          allowMultiple={false}
          className="width-18"
          stats={[reduce?.reducer || ReducerID.sum]}
          onChange={onStatsChange}
          defaultStat={ReducerID.sum}
        />
      </InlineField>
    </>
  );
};

const IndexOptionsEditor = (props: {
  options: CalculateFieldTransformerOptions;
  onChange: (options: CalculateFieldTransformerOptions) => void;
}) => {
  const { options, onChange } = props;
  const { index } = options;

  const onToggleRowIndexAsPercentile = (e: React.FormEvent<HTMLInputElement>) => {
    onChange({
      ...options,
      index: {
        asPercentile: e.currentTarget.checked,
      },
    });
  };
  return (
    <>
      <InlineField labelWidth={labelWidth} label="As percentile" tooltip="Transform the row index as a percentile.">
        <InlineSwitch value={!!index?.asPercentile} onChange={onToggleRowIndexAsPercentile} />
      </InlineField>
    </>
  );
};

const UnaryOperationEditor = (props: {
  options: CalculateFieldTransformerOptions;
  names: string[];
  onChange: (options: CalculateFieldTransformerOptions) => void;
}) => {
  const { options, onChange } = props;
  const { unary } = options;

  const updateUnaryOptions = (v: UnaryOptions) => {
    onChange({
      ...options,
      mode: CalculateFieldMode.UnaryOperation,
      unary: v,
    });
  };

  const onUnaryOperationChanged = (v: SelectableValue<UnaryOperationID>) => {
    updateUnaryOptions({
      ...unary!,
      operator: v.value!,
    });
  };

  const onUnaryValueChanged = (v: SelectableValue<string>) => {
    updateUnaryOptions({
      ...unary!,
      fieldName: v.value!,
    });
  };

  let found = !unary?.fieldName;
  const names = props.names.map((v) => {
    if (v === unary?.fieldName) {
      found = true;
    }
    return { label: v, value: v };
  });

  const ops = unaryOperators.list().map((v) => {
    return { label: v.unaryOperationID, value: v.unaryOperationID };
  });

  const fieldName = found ? names : [...names, { label: unary?.fieldName, value: unary?.fieldName }];

  // TODO: default operation?
  return (
    <>
      <InlineFieldRow>
        <InlineField label="Operation" labelWidth={labelWidth}>
          <Select options={ops} value={options.unary ?? ops[0].value} onChange={onUnaryOperationChanged} />
        </InlineField>
        <InlineField label="(" labelWidth={2}>
          <Select
            placeholder="Field"
            className="min-width-11"
            options={fieldName}
            value={unary?.fieldName}
            onChange={onUnaryValueChanged}
          />
        </InlineField>
        <InlineLabel width={2}>)</InlineLabel>
      </InlineFieldRow>
    </>
  );
};

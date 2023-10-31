import { defaults } from 'lodash';
import React, { ChangeEvent } from 'react';
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

interface CalculateFieldTransformerEditorProps extends TransformerUIProps<CalculateFieldTransformerOptions> {}

interface CalculateFieldTransformerEditorState {
  include: string[];
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

export class CalculateFieldTransformerEditor extends React.PureComponent<
  CalculateFieldTransformerEditorProps,
  CalculateFieldTransformerEditorState
> {
  constructor(props: CalculateFieldTransformerEditorProps) {
    super(props);

    this.state = {
      include: props.options?.reduce?.include || [],
      names: [],
      selected: [],
    };
  }

  componentDidMount() {
    this.initOptions();
  }

  componentDidUpdate(oldProps: CalculateFieldTransformerEditorProps) {
    if (this.props.input !== oldProps.input) {
      this.initOptions();
    }
  }

  private initOptions() {
    const { options } = this.props;
    const configuredOptions = options?.reduce?.include || [];
    const ctx = { interpolate: (v: string) => v };
    const subscription = of(this.props.input)
      .pipe(
        standardTransformers.ensureColumnsTransformer.operator(null, ctx),
        this.extractAllNames(),
        this.getVariableNames(),
        this.extractNamesAndSelected(configuredOptions)
      )
      .subscribe(({ selected, names }) => {
        this.setState({ names, selected }, () => subscription.unsubscribe());
      });
  }

  private getVariableNames(): OperatorFunction<string[], string[]> {
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
  }

  private extractAllNames(): OperatorFunction<DataFrame[], string[]> {
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
  }

  private extractNamesAndSelected(
    configuredOptions: string[]
  ): OperatorFunction<string[], { names: string[]; selected: string[] }> {
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
  }

  onToggleReplaceFields = (e: React.FormEvent<HTMLInputElement>) => {
    const { options } = this.props;
    this.props.onChange({
      ...options,
      replaceFields: e.currentTarget.checked,
    });
  };

  onToggleRowIndexAsPercentile = (e: React.FormEvent<HTMLInputElement>) => {
    const { options } = this.props;
    this.props.onChange({
      ...options,
      index: {
        asPercentile: e.currentTarget.checked,
      },
    });
  };

  onModeChanged = (value: SelectableValue<CalculateFieldMode>) => {
    const { options, onChange } = this.props;
    const mode = value.value ?? CalculateFieldMode.BinaryOperation;
    if (mode === CalculateFieldMode.WindowFunctions) {
      options.window = options.window ?? defaultWindowOptions;
    }
    onChange({
      ...options,
      mode,
    });
  };

  onAliasChanged = (evt: ChangeEvent<HTMLInputElement>) => {
    const { options } = this.props;
    this.props.onChange({
      ...options,
      alias: evt.target.value,
    });
  };

  //---------------------------------------------------------
  // Cumulative functions
  //---------------------------------------------------------

  updateReduceOptions = (v: ReduceOptions) => {
    const { options, onChange } = this.props;
    onChange({
      ...options,
      reduce: v,
    });
  };

  onFieldToggle = (fieldName: string) => {
    const { selected } = this.state;
    if (selected.indexOf(fieldName) > -1) {
      this.onChange(selected.filter((s) => s !== fieldName));
    } else {
      this.onChange([...selected, fieldName]);
    }
  };

  onChange = (selected: string[]) => {
    this.setState({ selected });
    const { reduce } = this.props.options;
    this.updateReduceOptions({
      ...reduce!,
      include: selected,
    });
  };

  onStatsChange = (stats: string[]) => {
    const reducer = stats.length ? (stats[0] as ReducerID) : ReducerID.sum;

    const { reduce } = this.props.options;
    this.updateReduceOptions({ ...reduce, reducer });
  };

  renderRowIndex(options?: IndexOptions) {
    return (
      <>
        <InlineField labelWidth={labelWidth} label="As percentile" tooltip="Transform the row index as a percentile.">
          <InlineSwitch value={!!options?.asPercentile} onChange={this.onToggleRowIndexAsPercentile} />
        </InlineField>
      </>
    );
  }

  //---------------------------------------------------------
  // Window functions
  //---------------------------------------------------------

  updateWindowOptions = (v: WindowOptions) => {
    const { options, onChange } = this.props;
    onChange({
      ...options,
      mode: CalculateFieldMode.WindowFunctions,
      window: v,
    });
  };

  onWindowFieldChange = (v: SelectableValue<string>) => {
    const { window } = this.props.options;
    this.updateWindowOptions({
      ...window!,
      field: v.value!,
    });
  };

  onWindowSizeChange = (v?: number) => {
    const { window } = this.props.options;
    this.updateWindowOptions({
      ...window!,
      windowSize: v && window?.windowSizeMode === WindowSizeMode.Percentage ? v / 100 : v,
    });
  };

  onWindowSizeModeChange = (val: string) => {
    const { window } = this.props.options;
    // eslint-disable-next-line
    const mode = val as WindowSizeMode;
    this.updateWindowOptions({
      ...window!,
      windowSize: window?.windowSize
        ? mode === WindowSizeMode.Percentage
          ? window!.windowSize! / 100
          : window!.windowSize! * 100
        : undefined,
      windowSizeMode: mode,
    });
  };

  onWindowStatsChange = (stats: string[]) => {
    // TODO: try to fix this type assertion
    // eslint-disable-next-line
    const reducer = stats.length ? (stats[0] as ReducerID) : ReducerID.sum;

    const { window } = this.props.options;
    this.updateWindowOptions({ ...window, reducer });
  };

  onTypeChange = (val: string) => {
    const { window } = this.props.options;
    this.updateWindowOptions({
      ...window!,
      windowAlignment: val as WindowAlignment,
    });
  };

  renderWindowFunctions(options?: WindowOptions) {
    const { names } = this.state;
    options = defaults(options, { reducer: ReducerID.sum });
    const selectOptions = names.map((v) => ({ label: v, value: v }));
    const typeOptions = [
      { label: 'Trailing', value: WindowAlignment.Trailing },
      { label: 'Centered', value: WindowAlignment.Centered },
    ];
    const windowSizeModeOptions = [
      { label: 'Percentage', value: WindowSizeMode.Percentage },
      { label: 'Fixed', value: WindowSizeMode.Fixed },
    ];

    return (
      <>
        <InlineField label="Field" labelWidth={labelWidth}>
          <Select
            placeholder="Field"
            options={selectOptions}
            className="min-width-18"
            value={options?.field}
            onChange={this.onWindowFieldChange}
          />
        </InlineField>
        <InlineField label="Calculation" labelWidth={labelWidth}>
          <StatsPicker
            allowMultiple={false}
            className="width-18"
            stats={[options.reducer]}
            onChange={this.onWindowStatsChange}
            defaultStat={ReducerID.mean}
            filterOptions={(ext) =>
              ext.id === ReducerID.mean || ext.id === ReducerID.variance || ext.id === ReducerID.stdDev
            }
          />
        </InlineField>
        <InlineField label="Type" labelWidth={labelWidth}>
          <RadioButtonGroup
            value={options.windowAlignment ?? WindowAlignment.Trailing}
            options={typeOptions}
            onChange={this.onTypeChange}
          />
        </InlineField>
        <InlineField label="Window size mode">
          <RadioButtonGroup
            value={options.windowSizeMode ?? WindowSizeMode.Percentage}
            options={windowSizeModeOptions}
            onChange={this.onWindowSizeModeChange}
          ></RadioButtonGroup>
        </InlineField>
        <InlineField
          label={options.windowSizeMode === WindowSizeMode.Percentage ? 'Window size %' : 'Window size'}
          labelWidth={labelWidth}
          tooltip={
            options.windowSizeMode === WindowSizeMode.Percentage
              ? 'Set the window size as a percentage of the total data'
              : 'Window size'
          }
        >
          <NumberInput
            placeholder="Auto"
            min={0.1}
            value={
              options.windowSize && options.windowSizeMode === WindowSizeMode.Percentage
                ? options.windowSize * 100
                : options.windowSize
            }
            onChange={this.onWindowSizeChange}
          ></NumberInput>
        </InlineField>
      </>
    );
  }

  //---------------------------------------------------------
  // Reduce by Row
  //---------------------------------------------------------

  onReducerStatsChange = (stats: string[]) => {
    // TODO: try to fix this type assertion
    // eslint-disable-next-line
    const reducer = stats.length ? (stats[0] as ReducerID) : ReducerID.sum;

    const { reduce } = this.props.options;
    this.updateReduceOptions({ ...reduce, reducer });
  };

  renderReduceRow(options?: ReduceOptions) {
    const { names, selected } = this.state;
    options = defaults(options, { reducer: ReducerID.sum });

    return (
      <>
        <InlineField label="Operation" labelWidth={labelWidth} grow={true}>
          <HorizontalGroup spacing="xs" align="flex-start" wrap>
            {names.map((o, i) => {
              return (
                <FilterPill
                  key={`${o}/${i}`}
                  onClick={() => {
                    this.onFieldToggle(o);
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
            stats={[options.reducer]}
            onChange={this.onStatsChange}
            defaultStat={ReducerID.sum}
          />
        </InlineField>
      </>
    );
  }

  //---------------------------------------------------------
  // Cumulative Operator
  //---------------------------------------------------------

  onCumulativeStatsChange = (stats: string[]) => {
    const reducer = stats.length ? (stats[0] as ReducerID) : ReducerID.sum;

    const { reduce } = this.props.options;
    this.updateCumulativeOptions({ ...reduce, reducer });
  };

  updateCumulativeOptions = (v: CumulativeOptions) => {
    const { options, onChange } = this.props;
    onChange({
      ...options,
      mode: CalculateFieldMode.CumulativeFunctions,
      cumulative: v,
    });
  };

  onCumulativeFieldChange = (v: SelectableValue<string>) => {
    const { cumulative } = this.props.options;
    this.updateCumulativeOptions({
      ...cumulative!,
      field: v.value!,
    });
  };

  renderCumulativeFunctions(options?: CumulativeOptions) {
    const { names } = this.state;
    options = defaults(options, { reducer: ReducerID.sum });
    const selectOptions = names.map((v) => ({ label: v, value: v }));

    return (
      <>
        <InlineField label="Field" labelWidth={labelWidth}>
          <Select
            placeholder="Field"
            options={selectOptions}
            className="min-width-18"
            value={options?.field}
            onChange={this.onCumulativeFieldChange}
          />
        </InlineField>
        <InlineField label="Calculation" labelWidth={labelWidth}>
          <StatsPicker
            allowMultiple={false}
            className="width-18"
            stats={[options.reducer]}
            onChange={this.onCumulativeStatsChange}
            defaultStat={ReducerID.sum}
            filterOptions={(ext) => ext.id === ReducerID.sum || ext.id === ReducerID.mean}
          />
        </InlineField>
      </>
    );
  }

  //---------------------------------------------------------
  // Binary Operator
  //---------------------------------------------------------

  updateBinaryOptions = (v: BinaryOptions) => {
    const { options, onChange } = this.props;
    onChange({
      ...options,
      mode: CalculateFieldMode.BinaryOperation,
      binary: v,
    });
  };

  onBinaryLeftChanged = (v: SelectableValue<string>) => {
    const { binary } = this.props.options;
    this.updateBinaryOptions({
      ...binary!,
      left: v.value!,
    });
  };

  onBinaryRightChanged = (v: SelectableValue<string>) => {
    const { binary } = this.props.options;
    this.updateBinaryOptions({
      ...binary!,
      right: v.value!,
    });
  };

  onBinaryOperationChanged = (v: SelectableValue<BinaryOperationID>) => {
    const { binary } = this.props.options;
    this.updateBinaryOptions({
      ...binary!,
      operator: v.value!,
    });
  };

  renderBinaryOperation(options?: BinaryOptions) {
    options = defaults(options, { operator: BinaryOperationID.Add });

    let foundLeft = !options?.left;
    let foundRight = !options?.right;
    const names = this.state.names.map((v) => {
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
              onChange={this.onBinaryLeftChanged}
            />
          </InlineField>
          <InlineField>
            <Select
              className="width-4"
              options={ops}
              value={options.operator ?? ops[0].value}
              onChange={this.onBinaryOperationChanged}
            />
          </InlineField>
          <InlineField>
            <Select
              allowCustomValue={true}
              placeholder="Field or number"
              className="min-width-10"
              options={rightNames}
              value={options?.right}
              onChange={this.onBinaryRightChanged}
            />
          </InlineField>
        </InlineFieldRow>
      </>
    );
  }

  //---------------------------------------------------------
  // Unary Operator
  //---------------------------------------------------------

  updateUnaryOptions = (v: UnaryOptions) => {
    const { options, onChange } = this.props;
    onChange({
      ...options,
      mode: CalculateFieldMode.UnaryOperation,
      unary: v,
    });
  };

  onUnaryOperationChanged = (v: SelectableValue<UnaryOperationID>) => {
    const { unary } = this.props.options;
    this.updateUnaryOptions({
      ...unary!,
      operator: v.value!,
    });
  };

  onUnaryValueChanged = (v: SelectableValue<string>) => {
    const { unary } = this.props.options;
    this.updateUnaryOptions({
      ...unary!,
      fieldName: v.value!,
    });
  };

  renderUnaryOperation(options?: UnaryOptions) {
    options = defaults(options, { operator: UnaryOperationID.Abs });

    let found = !options?.fieldName;
    const names = this.state.names.map((v) => {
      if (v === options?.fieldName) {
        found = true;
      }
      return { label: v, value: v };
    });

    const ops = unaryOperators.list().map((v) => {
      return { label: v.unaryOperationID, value: v.unaryOperationID };
    });

    const fieldName = found ? names : [...names, { label: options?.fieldName, value: options?.fieldName }];

    return (
      <>
        <InlineFieldRow>
          <InlineField label="Operation" labelWidth={labelWidth}>
            <Select options={ops} value={options.operator ?? ops[0].value} onChange={this.onUnaryOperationChanged} />
          </InlineField>
          <InlineField label="(" labelWidth={2}>
            <Select
              placeholder="Field"
              className="min-width-11"
              options={fieldName}
              value={options?.fieldName}
              onChange={this.onUnaryValueChanged}
            />
          </InlineField>
          <InlineLabel width={2}>)</InlineLabel>
        </InlineFieldRow>
      </>
    );
  }

  //---------------------------------------------------------
  // Render
  //---------------------------------------------------------

  render() {
    const { options } = this.props;

    const mode = options.mode ?? CalculateFieldMode.BinaryOperation;

    return (
      <>
        <InlineField labelWidth={labelWidth} label="Mode">
          <Select
            className="width-18"
            options={calculationModes}
            value={calculationModes.find((v) => v.value === mode)}
            onChange={this.onModeChanged}
          />
        </InlineField>
        {mode === CalculateFieldMode.BinaryOperation && this.renderBinaryOperation(options.binary)}
        {mode === CalculateFieldMode.UnaryOperation && this.renderUnaryOperation(options.unary)}
        {mode === CalculateFieldMode.ReduceRow && this.renderReduceRow(options.reduce)}
        {mode === CalculateFieldMode.CumulativeFunctions && this.renderCumulativeFunctions(options.cumulative)}
        {mode === CalculateFieldMode.WindowFunctions && this.renderWindowFunctions(options.window)}
        {mode === CalculateFieldMode.Index && this.renderRowIndex(options.index)}
        <InlineField labelWidth={labelWidth} label="Alias">
          <Input
            className="width-18"
            value={options.alias ?? ''}
            placeholder={getNameFromOptions(options)}
            onChange={this.onAliasChanged}
          />
        </InlineField>
        <InlineField labelWidth={labelWidth} label="Replace all fields">
          <InlineSwitch value={!!options.replaceFields} onChange={this.onToggleReplaceFields} />
        </InlineField>
      </>
    );
  }
}

export const calculateFieldTransformRegistryItem: TransformerRegistryItem<CalculateFieldTransformerOptions> = {
  id: DataTransformerID.calculateField,
  editor: CalculateFieldTransformerEditor,
  transformation: standardTransformers.calculateFieldTransformer,
  name: 'Add field from calculation',
  description: 'Use the row values to calculate a new field.',
  categories: new Set([TransformerCategory.CalculateNewFields]),
};

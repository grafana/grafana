import { defaults } from 'lodash';
import React, { ChangeEvent } from 'react';
import { of, OperatorFunction } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  BinaryOperationID,
  binaryOperators,
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
} from '@grafana/data';
import {
  BinaryOptions,
  CalculateFieldMode,
  CalculateFieldTransformerOptions,
  getNameFromOptions,
  ReduceOptions,
} from '@grafana/data/src/transformations/transformers/calculateField';
import { FilterPill, HorizontalGroup, Input, LegacyForms, Select, StatsPicker } from '@grafana/ui';

interface CalculateFieldTransformerEditorProps extends TransformerUIProps<CalculateFieldTransformerOptions> {}

interface CalculateFieldTransformerEditorState {
  include: string[];
  names: string[];
  selected: string[];
}

const calculationModes = [
  { value: CalculateFieldMode.BinaryOperation, label: 'Binary operation' },
  { value: CalculateFieldMode.ReduceRow, label: 'Reduce row' },
  { value: CalculateFieldMode.Index, label: 'Row index' },
];

const okTypes = new Set<FieldType>([FieldType.time, FieldType.number, FieldType.string]);

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
        this.extractNamesAndSelected(configuredOptions)
      )
      .subscribe(({ selected, names }) => {
        this.setState({ names, selected }, () => subscription.unsubscribe());
      });
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

  onToggleReplaceFields = () => {
    const { options } = this.props;
    this.props.onChange({
      ...options,
      replaceFields: !options.replaceFields,
    });
  };

  onModeChanged = (value: SelectableValue<CalculateFieldMode>) => {
    const { options, onChange } = this.props;
    const mode = value.value ?? CalculateFieldMode.BinaryOperation;
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
  // Reduce by Row
  //---------------------------------------------------------

  updateReduceOptions = (v: ReduceOptions) => {
    const { options, onChange } = this.props;
    onChange({
      ...options,
      mode: CalculateFieldMode.ReduceRow,
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

  renderReduceRow(options?: ReduceOptions) {
    const { names, selected } = this.state;
    options = defaults(options, { reducer: ReducerID.sum });

    return (
      <>
        <div className="gf-form-inline">
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label width-8">Field name</div>
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
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <div className="gf-form-label width-8">Calculation</div>
            <StatsPicker
              allowMultiple={false}
              className="width-18"
              stats={[options.reducer]}
              onChange={this.onStatsChange}
              defaultStat={ReducerID.sum}
            />
          </div>
        </div>
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

  onBinaryOperationChanged = (v: SelectableValue<string>) => {
    const { binary } = this.props.options;
    this.updateBinaryOptions({
      ...binary!,
      operator: v.value! as BinaryOperationID,
    });
  };

  renderBinaryOperation(options?: BinaryOptions) {
    options = defaults(options, { reducer: ReducerID.sum });

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
      return { label: v.id, value: v.id };
    });

    return (
      <div className="gf-form-inline">
        <div className="gf-form">
          <div className="gf-form-label width-8">Operation</div>
        </div>
        <div className="gf-form">
          <Select
            allowCustomValue={true}
            placeholder="Field or number"
            options={leftNames}
            className="min-width-18 gf-form-spacing"
            value={options?.left}
            onChange={this.onBinaryLeftChanged}
          />
          <Select
            className="width-8 gf-form-spacing"
            options={ops}
            value={options.operator ?? ops[0].value}
            onChange={this.onBinaryOperationChanged}
          />
          <Select
            allowCustomValue={true}
            placeholder="Field or number"
            className="min-width-10"
            options={rightNames}
            value={options?.right}
            onChange={this.onBinaryRightChanged}
          />
        </div>
      </div>
    );
  }

  //---------------------------------------------------------
  // Render
  //---------------------------------------------------------

  render() {
    const { options } = this.props;

    const mode = options.mode ?? CalculateFieldMode.BinaryOperation;

    return (
      <div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <div className="gf-form-label width-8">Mode</div>
            <Select
              className="width-18"
              options={calculationModes}
              value={calculationModes.find((v) => v.value === mode)}
              onChange={this.onModeChanged}
            />
          </div>
        </div>
        {mode === CalculateFieldMode.BinaryOperation && this.renderBinaryOperation(options.binary)}
        {mode === CalculateFieldMode.ReduceRow && this.renderReduceRow(options.reduce)}
        <div className="gf-form-inline">
          <div className="gf-form">
            <div className="gf-form-label width-8">Alias</div>
            <Input
              className="width-18"
              value={options.alias ?? ''}
              placeholder={getNameFromOptions(options)}
              onChange={this.onAliasChanged}
            />
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <LegacyForms.Switch
              label="Replace all fields"
              labelClass="width-8"
              checked={!!options.replaceFields}
              onChange={this.onToggleReplaceFields}
            />
          </div>
        </div>
      </div>
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

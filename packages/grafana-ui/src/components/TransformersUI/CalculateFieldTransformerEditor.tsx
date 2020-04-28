import React, { ChangeEvent } from 'react';
import {
  CalculateFieldTransformerOptions,
  DataTransformerID,
  fieldReducers,
  FieldType,
  KeyValue,
  ReducerID,
  standardTransformers,
  TransformerRegistyItem,
  TransformerUIProps,
  NullValueMode,
  BinaryOperationID,
  SelectableValue,
  binaryOperators,
} from '@grafana/data';
import { StatsPicker } from '../StatsPicker/StatsPicker';
import { Switch } from '../Forms/Legacy/Switch/Switch';
import { Input } from '../Input/Input';
import { FilterPill } from '../FilterPill/FilterPill';
import { HorizontalGroup } from '../Layout/Layout';
import { CalculateFieldMode } from '@grafana/data/src/transformations/transformers/calculateField';
import { Select } from '../Select/Select';
import defaults from 'lodash/defaults';

// Copied from @grafana/data ;(  not sure how to best support his
interface ReduceOptions {
  include?: string; // Assume all fields
  reducer: ReducerID;
  nullValueMode?: NullValueMode;
}

interface BinaryOptions {
  left: string;
  operator: BinaryOperationID;
  right: string;
}

interface ScaleOptions {
  left: string;
  operator: BinaryOperationID;
  right: number;
}

interface CalculateFieldTransformerEditorProps extends TransformerUIProps<CalculateFieldTransformerOptions> {}

interface CalculateFieldTransformerEditorState {
  include: string;
  names: string[];
  selected: string[];
}

const calculationModes = [
  { value: CalculateFieldMode.ReduceRow, label: 'Reduce Row' },
  { value: CalculateFieldMode.BinaryOperation, label: 'Binary Operation' },
  { value: CalculateFieldMode.Scale, label: 'Scale Field' },
];

export class CalculateFieldTransformerEditor extends React.PureComponent<
  CalculateFieldTransformerEditorProps,
  CalculateFieldTransformerEditorState
> {
  constructor(props: CalculateFieldTransformerEditorProps) {
    super(props);

    this.state = {
      include: props.options?.reduce?.include || '',
      names: [],
      selected: [],
    };
  }

  componentDidMount() {
    this.initOptions();
  }

  private initOptions() {
    const { input, options } = this.props;
    const include = options?.reduce?.include || '';
    const configuredOptions = include.split('|');

    const allNames: string[] = [];
    const byName: KeyValue<boolean> = {};
    for (const frame of input) {
      for (const field of frame.fields) {
        if (field.type !== FieldType.number) {
          continue;
        }
        if (!byName[field.name]) {
          byName[field.name] = true;
          allNames.push(field.name);
        }
      }
    }

    if (configuredOptions.length) {
      const options: string[] = [];
      const selected: string[] = [];
      for (const v of allNames) {
        if (configuredOptions.includes(v)) {
          selected.push(v);
        }
        options.push(v);
      }

      this.setState({
        names: options,
        selected: selected,
      });
    } else {
      this.setState({ names: allNames, selected: [] });
    }
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
    const mode = value.value ?? CalculateFieldMode.ReduceRow;
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
      this.onChange(selected.filter(s => s !== fieldName));
    } else {
      this.onChange([...selected, fieldName]);
    }
  };

  onChange = (selected: string[]) => {
    this.setState({ selected });
    const { reduce } = this.props.options;
    this.updateReduceOptions({
      ...reduce!,
      include: selected.join('|'),
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
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label width-8">Calculation</div>
            <StatsPicker
              allowMultiple={false}
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
    const names = this.state.names.map(v => {
      return { label: v, value: v };
    });
    const ops = binaryOperators.list().map(v => {
      return { label: v.id, value: v.id };
    });

    return (
      <div className="gf-form-inline">
        <div className="gf-form-label width-8">Operation</div>
        <div className="gf-form gf-form--grow">
          <Select
            options={names}
            value={calculationModes.find(v => v.value === options?.left)}
            onChange={this.onBinaryLeftChanged}
          />
          <Select
            options={ops}
            value={ops.find(v => v.value === options?.operator)}
            onChange={this.onBinaryOperationChanged}
          />
          <Select
            options={names}
            value={calculationModes.find(v => v.value === options?.right)}
            onChange={this.onBinaryRightChanged}
          />
        </div>
      </div>
    );
  }

  //---------------------------------------------------------
  // Scale Operator
  //---------------------------------------------------------

  updateScaleOptions = (v: ScaleOptions) => {
    const { options, onChange } = this.props;
    onChange({
      ...options,
      mode: CalculateFieldMode.Scale,
      scale: v,
    });
  };

  onScaleLeftChanged = (v: SelectableValue<string>) => {
    const { scale } = this.props.options;
    this.updateScaleOptions({
      ...scale!,
      left: v.value!,
    });
  };

  onScaleValueChanged = (v: ChangeEvent<any>) => {
    const { scale } = this.props.options;
    this.updateScaleOptions({
      ...scale!,
      right: parseFloat(v.target.value),
    });
  };

  onScaleOperationChanged = (v: SelectableValue<string>) => {
    const { scale } = this.props.options;
    this.updateScaleOptions({
      ...scale!,
      operator: v.value! as BinaryOperationID,
    });
  };

  renderScaleOperation(options?: ScaleOptions) {
    options = defaults(options, { operator: ReducerID.sum });
    const names = this.state.names.map(v => {
      return { label: v, value: v };
    });
    const ops = binaryOperators.list().map(v => {
      return { label: v.id, value: v.id };
    });

    return (
      <div className="gf-form-inline">
        <div className="gf-form-label width-8">Operation</div>
        <div className="gf-form gf-form--grow">
          <Select
            options={names}
            value={calculationModes.find(v => v.value === options?.left)}
            onChange={this.onScaleLeftChanged}
          />
          <Select
            options={ops}
            value={ops.find(v => v.value === options?.operator)}
            onChange={this.onScaleOperationChanged}
          />
          <Input type="number" value={options.right || 0} onChange={this.onScaleValueChanged} />
        </div>
      </div>
    );
  }

  //---------------------------------------------------------
  // Render
  //---------------------------------------------------------

  render() {
    const { options } = this.props;

    const mode = options.mode ?? CalculateFieldMode.ReduceRow;

    let aliasPlaceholder = '';
    if (mode === CalculateFieldMode.ReduceRow) {
      const r = fieldReducers.getIfExists(options.reduce?.reducer);
      aliasPlaceholder = r ? r?.name : ReducerID.sum;
    } else if (mode === CalculateFieldMode.BinaryOperation) {
      const o = binaryOperators.getIfExists(options.binary?.operator);
      aliasPlaceholder = o ? o.name : '';
    } else if (mode === CalculateFieldMode.Scale) {
      const o = binaryOperators.getIfExists(options.scale?.operator);
      aliasPlaceholder = o ? o.name : '';
    }

    return (
      <div>
        <div className="gf-form-inline">
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label width-8">Mode</div>
            <Select
              options={calculationModes}
              value={calculationModes.find(v => v.value === mode)}
              onChange={this.onModeChanged}
            />
          </div>
        </div>
        {mode === CalculateFieldMode.ReduceRow && this.renderReduceRow(options.reduce)}
        {mode === CalculateFieldMode.BinaryOperation && this.renderBinaryOperation(options.binary)}
        {mode === CalculateFieldMode.Scale && this.renderScaleOperation(options.scale)}
        <div className="gf-form-inline">
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label width-8">Alias</div>
            <Input value={options.alias} placeholder={aliasPlaceholder} onChange={this.onAliasChanged} />
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form gf-form--grow">
            <Switch
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

export const calculateFieldTransformRegistryItem: TransformerRegistyItem<CalculateFieldTransformerOptions> = {
  id: DataTransformerID.calculateField,
  editor: CalculateFieldTransformerEditor,
  transformation: standardTransformers.calculateFieldTransformer,
  name: 'Add field from calculation',
  description: 'Use the row values to calculate a new field',
};

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
} from '@grafana/data';
import { StatsPicker } from '../StatsPicker/StatsPicker';
import { Switch } from '../Forms/Legacy/Switch/Switch';
import { Input } from '../Input/Input';
import { FilterPill } from '../FilterPill/FilterPill';
import { HorizontalGroup } from '../Layout/Layout';

interface CalculateFieldTransformerEditorProps extends TransformerUIProps<CalculateFieldTransformerOptions> {}

interface CalculateFieldTransformerEditorState {
  include: string;
  names: string[];
  selected: string[];
}

export class CalculateFieldTransformerEditor extends React.PureComponent<
  CalculateFieldTransformerEditorProps,
  CalculateFieldTransformerEditorState
> {
  constructor(props: CalculateFieldTransformerEditorProps) {
    super(props);
    this.state = {
      include: props.options.include || '',
      names: [],
      selected: [],
    };
  }

  componentDidMount() {
    this.initOptions();
  }

  private initOptions() {
    const { input, options } = this.props;
    const configuredOptions = options.include ? options.include.split('|') : [];

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
    this.props.onChange({
      ...this.props.options,
      include: selected.join('|'),
    });
  };

  onToggleReplaceFields = () => {
    const { options } = this.props;
    this.props.onChange({
      ...options,
      replaceFields: !options.replaceFields,
    });
  };

  onAliasChanged = (evt: ChangeEvent<HTMLInputElement>) => {
    const { options } = this.props;
    this.props.onChange({
      ...options,
      alias: evt.target.value,
    });
  };

  onStatsChange = (stats: string[]) => {
    this.props.onChange({
      ...this.props.options,
      reducer: stats.length ? (stats[0] as ReducerID) : ReducerID.sum,
    });
  };

  render() {
    const { options } = this.props;
    const { names, selected } = this.state;
    const reducer = fieldReducers.get(options.reducer);

    return (
      <div>
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
            <StatsPicker stats={[options.reducer]} onChange={this.onStatsChange} defaultStat={ReducerID.sum} />
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label width-8">Alias</div>
            <Input value={options.alias} placeholder={reducer.name} onChange={this.onAliasChanged} />
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
            {!!options.replaceFields && (
              <Switch
                label="Keep Time Field"
                labelClass="width-8"
                checked={!!options.replaceFields}
                onChange={this.onToggleReplaceFields}
              />
            )}
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

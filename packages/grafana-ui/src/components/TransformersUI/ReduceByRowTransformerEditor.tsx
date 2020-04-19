import React, { useContext, ChangeEvent } from 'react';
import {
  DataTransformerID,
  ReduceByRowTransformerOptions,
  KeyValue,
  standardTransformers,
  TransformerRegistyItem,
  TransformerUIProps,
  FieldType,
  ReducerID,
  fieldReducers,
} from '@grafana/data';
import { ThemeContext } from '../../themes/ThemeContext';
import { css } from 'emotion';
import { InlineList } from '../List/InlineList';
import { Icon } from '../Icon/Icon';
import { Label } from '../Forms/Label';
import { StatsPicker } from '../StatsPicker/StatsPicker';
import { Switch } from '../Switch/Switch';
import Forms from '../Forms';
import { Input } from '../Input/Input';

interface ReduceByRowTransformerEditorProps extends TransformerUIProps<ReduceByRowTransformerOptions> {}

interface ReduceByRowTransformerEditorState {
  include: string;
  names: string[];
  selected: string[];
}

export class ReduceByRowTransformerEditor extends React.PureComponent<
  ReduceByRowTransformerEditorProps,
  ReduceByRowTransformerEditorState
> {
  constructor(props: ReduceByRowTransformerEditorProps) {
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

  onToggleReplaceFields = (evt: ChangeEvent<HTMLInputElement>) => {
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
        <Label>Numeric Fields</Label>
        <InlineList
          items={names}
          renderItem={(o, i) => {
            return (
              <span
                className={css`
                  margin-right: ${i === names.length - 1 ? '0' : '10px'};
                `}
              >
                <FilterPill
                  onClick={() => {
                    this.onFieldToggle(o);
                  }}
                  label={o}
                  selected={selected.indexOf(o) > -1}
                />
              </span>
            );
          }}
        />
        <Label>Calculation</Label>
        <StatsPicker
          placeholder="Choose Stat"
          stats={[options.reducer]}
          onChange={this.onStatsChange}
          defaultStat={ReducerID.sum}
        />
        <Label>Alias</Label>
        <Input value={options.alias} placeholder={reducer.name} onChange={this.onAliasChanged} />

        <Label>Replace all fields</Label>
        <Switch checked={options.replaceFields} onChange={this.onToggleReplaceFields} />

        {/*  nullValueMode?: NullValueMode; */}
      </div>
    );
  }
}

interface FilterPillProps {
  selected: boolean;
  label: string;
  onClick: React.MouseEventHandler<HTMLElement>;
}
const FilterPill: React.FC<FilterPillProps> = ({ label, selected, onClick }) => {
  const theme = useContext(ThemeContext);
  return (
    <div
      className={css`
        padding: ${theme.spacing.xxs} ${theme.spacing.sm};
        color: white;
        background: ${selected ? theme.palette.blue95 : theme.palette.blue77};
        border-radius: 16px;
        display: inline-block;
        cursor: pointer;
      `}
      onClick={onClick}
    >
      {selected && (
        <Icon
          className={css`
            margin-right: 4px;
          `}
          name="check"
        />
      )}
      {label}
    </div>
  );
};

export const reduceByRowTransformRegistryItem: TransformerRegistyItem<ReduceByRowTransformerOptions> = {
  id: DataTransformerID.reduceByRow,
  editor: ReduceByRowTransformerEditor,
  transformation: standardTransformers.reduceByRowTransformer,
  name: 'Reduce by Row',
  description: 'Create a new colum from the other columns',
};

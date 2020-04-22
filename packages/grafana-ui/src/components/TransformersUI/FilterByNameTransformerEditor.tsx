import React from 'react';
import {
  DataTransformerID,
  FilterFieldsByNameTransformerOptions,
  KeyValue,
  standardTransformers,
  TransformerRegistyItem,
  TransformerUIProps,
} from '@grafana/data';
import { HorizontalGroup } from '../Layout/Layout';
import { Input } from '../Input/Input';
import { FilterPill } from '../FilterPill/FilterPill';

interface FilterByNameTransformerEditorProps extends TransformerUIProps<FilterFieldsByNameTransformerOptions> {}

interface FilterByNameTransformerEditorState {
  include: string[];
  options: FieldNameInfo[];
  selected: string[];
  regex?: string;
}

interface FieldNameInfo {
  name: string;
  count: number;
}
export class FilterByNameTransformerEditor extends React.PureComponent<
  FilterByNameTransformerEditorProps,
  FilterByNameTransformerEditorState
> {
  constructor(props: FilterByNameTransformerEditorProps) {
    super(props);
    this.state = {
      include: props.options.include || [],
      options: [],
      selected: [],
    };
  }

  componentDidMount() {
    this.initOptions();
  }

  private initOptions() {
    const { input, options } = this.props;
    const configuredOptions = options.include ? options.include : [];

    const allNames: FieldNameInfo[] = [];
    const byName: KeyValue<FieldNameInfo> = {};

    for (const frame of input) {
      for (const field of frame.fields) {
        let v = byName[field.name];
        if (!v) {
          v = byName[field.name] = {
            name: field.name,
            count: 0,
          };
          allNames.push(v);
        }
        v.count++;
      }
    }

    let regexOption;

    if (configuredOptions.length) {
      let selected: FieldNameInfo[] = [];

      for (const o of configuredOptions) {
        const selectedFields = allNames.filter(n => n.name === o);
        if (selectedFields.length > 0) {
          selected = selected.concat(selectedFields);
        } else {
          // there can be only one regex in the options
          regexOption = o;
        }
      }

      this.setState({
        options: allNames,
        selected: selected.map(s => s.name),
        regex: regexOption,
      });
    } else {
      this.setState({ options: allNames, selected: allNames.map(n => n.name) });
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
    this.setState({ selected }, () => {
      this.props.onChange({
        ...this.props.options,
        include: this.state.regex ? [...selected, this.state.regex] : selected,
      });
    });
  };

  onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { selected, regex } = this.state;
    this.props.onChange({
      ...this.props.options,
      include: regex ? [...selected, regex] : selected,
    });
  };

  render() {
    const { options, selected } = this.state;
    return (
      <div className="gf-form-inline">
        <div className="gf-form gf-form--grow">
          <div className="gf-form-label width-8">Field name</div>
          <HorizontalGroup spacing="xs">
            <Input
              placeholder="Regular expression pattern"
              value={this.state.regex || ''}
              onChange={e => this.setState({ regex: e.currentTarget.value })}
              onBlur={this.onInputBlur}
              width={25}
            />
            {options.map((o, i) => {
              const label = `${o.name}${o.count > 1 ? ' (' + o.count + ')' : ''}`;
              const isSelected = selected.indexOf(o.name) > -1;
              return (
                <FilterPill
                  key={`${o.name}/${i}`}
                  onClick={() => {
                    this.onFieldToggle(o.name);
                  }}
                  label={label}
                  selected={isSelected}
                />
              );
            })}
          </HorizontalGroup>
        </div>
      </div>
    );
  }
}

export const filterFieldsByNameTransformRegistryItem: TransformerRegistyItem<FilterFieldsByNameTransformerOptions> = {
  id: DataTransformerID.filterFieldsByName,
  editor: FilterByNameTransformerEditor,
  transformation: standardTransformers.filterFieldsByNameTransformer,
  name: 'Filter by name',
  description: 'Filter fields by name',
};

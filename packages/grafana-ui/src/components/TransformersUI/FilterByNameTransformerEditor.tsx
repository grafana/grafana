import React from 'react';
import {
  DataTransformerID,
  FilterFieldsByNameTransformerOptions,
  KeyValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { HorizontalGroup } from '../Layout/Layout';
import { Input } from '../Input/Input';
import { FilterPill } from '../FilterPill/FilterPill';
import { Field } from '../Forms/Field';
import { css } from 'emotion';

interface FilterByNameTransformerEditorProps extends TransformerUIProps<FilterFieldsByNameTransformerOptions> {}

interface FilterByNameTransformerEditorState {
  include: string[];
  options: FieldNameInfo[];
  selected: string[];
  regex?: string;
  isRegexValid?: boolean;
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
      isRegexValid: true,
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
    const { regex, isRegexValid } = this.state;
    let include = selected;

    if (regex && isRegexValid) {
      include = include.concat([regex]);
    }

    this.setState({ selected }, () => {
      this.props.onChange({
        ...this.props.options,
        include,
      });
    });
  };

  onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { selected, regex } = this.state;
    let isRegexValid = true;
    try {
      if (regex) {
        new RegExp(regex);
      }
    } catch (e) {
      isRegexValid = false;
    }
    if (isRegexValid) {
      this.props.onChange({
        ...this.props.options,
        include: regex ? [...selected, regex] : selected,
      });
    } else {
      this.props.onChange({
        ...this.props.options,
        include: selected,
      });
    }
    this.setState({
      isRegexValid,
    });
  };

  render() {
    const { options, selected, isRegexValid } = this.state;
    return (
      <div className="gf-form-inline">
        <div className="gf-form gf-form--grow">
          <div className="gf-form-label width-8">Field name</div>
          <HorizontalGroup spacing="xs" align="flex-start" wrap>
            <Field
              invalid={!isRegexValid}
              error={!isRegexValid ? 'Invalid pattern' : undefined}
              className={css`
                margin-bottom: 0;
              `}
            >
              <Input
                placeholder="Regular expression pattern"
                value={this.state.regex || ''}
                onChange={e => this.setState({ regex: e.currentTarget.value })}
                onBlur={this.onInputBlur}
                width={25}
              />
            </Field>
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

export const filterFieldsByNameTransformRegistryItem: TransformerRegistryItem<FilterFieldsByNameTransformerOptions> = {
  id: DataTransformerID.filterFieldsByName,
  editor: FilterByNameTransformerEditor,
  transformation: standardTransformers.filterFieldsByNameTransformer,
  name: 'Filter by name',
  description: 'Removes part of the query results using a regex pattern. The pattern can be inclusive or exclusive.',
};

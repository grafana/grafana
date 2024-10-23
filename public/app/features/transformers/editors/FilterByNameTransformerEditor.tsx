import { css } from '@emotion/css';
import * as React from 'react';

import {
  DataTransformerID,
  KeyValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  getFieldDisplayName,
  stringToJsRegex,
  TransformerCategory,
  SelectableValue,
} from '@grafana/data';
import { FilterFieldsByNameTransformerOptions } from '@grafana/data/src/transformations/transformers/filterByName';
import { getTemplateSrv } from '@grafana/runtime/src/services';
import { Input, FilterPill, InlineFieldRow, InlineField, InlineSwitch, Select, Button, Stack } from '@grafana/ui';
import { Trans } from '@grafana/ui/src/utils/i18n';

import { getTransformationContent } from '../docs/getTransformationContent';

interface FilterByNameTransformerEditorProps extends TransformerUIProps<FilterFieldsByNameTransformerOptions> {}

interface FilterByNameTransformerEditorState {
  include: string[];
  options: FieldNameInfo[];
  selected: string[];
  regex?: string;
  variable?: string;
  variables: SelectableValue[];
  byVariable: boolean;
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
      include: props.options.include?.names || [],
      regex: props.options.include?.pattern,
      variable: props.options.include?.variable,
      byVariable: props.options.byVariable || false,
      options: [],
      variables: [],
      selected: [],
      isRegexValid: true,
    };
  }

  componentDidMount() {
    this.initOptions();
  }

  componentDidUpdate(oldProps: FilterByNameTransformerEditorProps) {
    if (this.props.input !== oldProps.input) {
      this.initOptions();
    }
  }

  private initOptions() {
    const { input, options } = this.props;
    const configuredOptions = Array.from(options.include?.names ?? []);

    const variables = getTemplateSrv()
      .getVariables()
      .map((v) => ({ label: '$' + v.name, value: '$' + v.name }));
    const allNames: FieldNameInfo[] = [];
    const byName: KeyValue<FieldNameInfo> = {};

    for (const frame of input) {
      for (const field of frame.fields) {
        const displayName = getFieldDisplayName(field, frame, input);
        let v = byName[displayName];

        if (!v) {
          v = byName[displayName] = {
            name: displayName,
            count: 0,
          };
          allNames.push(v);
        }

        v.count++;
      }
    }

    if (options.include?.pattern) {
      try {
        const regex = stringToJsRegex(options.include.pattern);

        for (const info of allNames) {
          if (regex.test(info.name)) {
            configuredOptions.push(info.name);
          }
        }
      } catch (error) {
        console.error(error);
      }
    }

    if (configuredOptions.length) {
      const selected: FieldNameInfo[] = allNames.filter((n) => configuredOptions.includes(n.name));

      this.setState({
        options: allNames,
        selected: selected.map((s) => s.name),
        variables: variables,
        byVariable: options.byVariable || false,
        variable: options.include?.variable,
        regex: options.include?.pattern,
      });
    } else {
      this.setState({
        options: allNames,
        selected: allNames.map((n) => n.name),
        variables: variables,
        byVariable: options.byVariable || false,
        variable: options.include?.variable,
        regex: options.include?.pattern,
      });
    }
  }

  onFieldToggle = (fieldName: string) => {
    const { selected } = this.state;
    if (selected.indexOf(fieldName) > -1) {
      this.onChange(selected.filter((s) => s !== fieldName));
    } else {
      this.onChange([...selected, fieldName]);
    }
  };

  onChange = (selected: string[]) => {
    const { regex, isRegexValid } = this.state;
    const options: FilterFieldsByNameTransformerOptions = {
      ...this.props.options,
      include: { names: selected },
    };

    if (regex && isRegexValid) {
      options.include = options.include ?? {};
      options.include.pattern = regex;
    }

    this.setState({ selected }, () => {
      this.props.onChange(options);
    });
  };

  onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { selected, regex } = this.state;
    let isRegexValid = true;

    try {
      if (regex) {
        stringToJsRegex(regex);
      }
    } catch (e) {
      isRegexValid = false;
    }

    if (isRegexValid) {
      this.props.onChange({
        ...this.props.options,
        include: { pattern: regex },
      });
    } else {
      this.props.onChange({
        ...this.props.options,
        include: { names: selected },
      });
    }

    this.setState({ isRegexValid });
  };

  onVariableChange = (selected: SelectableValue) => {
    this.props.onChange({
      ...this.props.options,
      include: { variable: selected.value },
    });

    this.setState({ variable: selected.value });
  };

  onFromVariableChange = (e: React.FormEvent<HTMLInputElement>) => {
    const val = e.currentTarget.checked;
    this.props.onChange({ ...this.props.options, byVariable: val });
    this.setState({ byVariable: val });
  };

  onSelectAll = () => {
    const allFieldNames = this.state.options.map((o) => o.name);
    this.onChange(allFieldNames);
  };

  onDeselectAll = () => {
    this.onChange([]);
  };

  render() {
    const { options, selected, isRegexValid } = this.state;
    return (
      <Stack direction="column" gap={2}>
        <InlineFieldRow>
          <InlineField label="From variable">
            <InlineSwitch value={this.state.byVariable} onChange={this.onFromVariableChange} />
          </InlineField>
        </InlineFieldRow>
        {this.state.byVariable ? (
          <InlineFieldRow>
            <InlineField label="Variable">
              <Select
                value={this.state.variable}
                onChange={this.onVariableChange}
                options={this.state.variables || []}
              />
            </InlineField>
          </InlineFieldRow>
        ) : (
          <Stack direction="column" gap={1}>
            <InlineFieldRow>
              <InlineField
                label="Identifier"
                invalid={!isRegexValid}
                error={!isRegexValid ? 'Invalid pattern' : undefined}
              >
                <Input
                  placeholder="Regular expression pattern"
                  value={this.state.regex || ''}
                  onChange={(e) => this.setState({ regex: e.currentTarget.value })}
                  onBlur={this.onInputBlur}
                  width={25}
                />
              </InlineField>
            </InlineFieldRow>
            <Stack direction="row" gap={1}>
              <Button variant="secondary" size="sm" onClick={this.onSelectAll}>
                <Trans i18nKey="grafana-ui.filter-by-name-transformer-editor.select-all">Select All</Trans>
              </Button>
              <Button variant="secondary" size="sm" onClick={this.onDeselectAll}>
                <Trans i18nKey="grafana-ui.filter-by-name-transformer-editor.deselect-all">Deselect All</Trans>
              </Button>
            </Stack>
            <div className={styles.pillContainer}>
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
            </div>
          </Stack>
        )}
      </Stack>
    );
  }
}

const styles = {
  pillContainer: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '8px',
  }),
};

export const filterFieldsByNameTransformRegistryItem: TransformerRegistryItem<FilterFieldsByNameTransformerOptions> = {
  id: DataTransformerID.filterFieldsByName,
  editor: FilterByNameTransformerEditor,
  transformation: standardTransformers.filterFieldsByNameTransformer,
  name: standardTransformers.filterFieldsByNameTransformer.name,
  description: 'Removes part of the query results using a regex pattern. The pattern can be inclusive or exclusive.',
  categories: new Set([TransformerCategory.Filter]),
  help: getTransformationContent(DataTransformerID.filterFieldsByName).helperDocs,
};

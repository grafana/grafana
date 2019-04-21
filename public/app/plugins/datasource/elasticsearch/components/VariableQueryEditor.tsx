import React, { PureComponent } from 'react';
import { VariableQueryProps } from 'app/types/plugins';
import { Select, FormLabel, SelectOptionItem } from '@grafana/ui';
import { MetricFindQueryTypes } from '../types';
import { FieldsQueryForm } from './FieldsQueryForm';
import { TermsQueryForm } from './TermsQueryForm';

export interface VariableQueryState {
  find: string;
  fields?: SelectOptionItem[];
  initialQuery?: any;
}

const queryTypes: SelectOptionItem[] = [
  { value: MetricFindQueryTypes.Fields, label: 'Fields' },
  { value: MetricFindQueryTypes.Terms, label: 'Terms' },
];

const defaultState: VariableQueryState = {
  find: queryTypes[0].value,
  fields: [],
};

export class ElasticVariableQueryEditor extends PureComponent<VariableQueryProps, VariableQueryState> {
  constructor(props: VariableQueryProps) {
    super(props);

    let query: any = {};
    if (this.props.query && this.props.query.length > 0) {
      query = JSON.parse(this.props.query);
    }

    query.initialQuery = { ...query };
    this.state = {
      ...defaultState,
      ...query,
    };
  }

  async componentDidMount() {
    const { templateSrv } = this.props;
    const fieldOptions = await this.getFields();
    const templateVariables = templateSrv.variables.map(v => ({
      label: `$${v.name}`,
      value: `$${v.name}`,
      description: v.current && v.current.value ? `Current value: ${v.current.value}` : v.label || v.name,
    }));
    const fields = [...templateVariables, ...fieldOptions];

    this.setState({
      fields,
    });
  }

  async getFields() {
    const { datasource } = this.props;
    return datasource.getFields({}).then((result: string[]) => {
      return result.map((field: any) => {
        return {
          value: field.text,
          label: field.text,
          description: field.type,
        };
      });
    });
  }

  onQueryTypeChange = (item: SelectOptionItem) => {
    this.setState({
      find: item.value,
    });
  };

  onQueryChange = (query: any, definition: string) => {
    const jsonQuery = JSON.stringify(query);
    this.props.onChange(jsonQuery, definition);
  };

  renderQueryType() {
    const { find, initialQuery, fields } = this.state;

    switch (find) {
      case MetricFindQueryTypes.Fields:
        return <FieldsQueryForm query={initialQuery} onChange={this.onQueryChange} />;
      case MetricFindQueryTypes.Terms:
        return <TermsQueryForm query={initialQuery} fields={fields} onChange={this.onQueryChange} />;
    }

    return '';
  }

  render() {
    const { find } = this.state;

    return (
      <>
        <div className="form-field">
          <FormLabel className="query-keyword">Query Type</FormLabel>
          <Select
            placeholder="Choose type"
            isSearchable={false}
            options={queryTypes}
            value={queryTypes.find(o => o.value === find)}
            onChange={this.onQueryTypeChange}
            width={11}
          />
        </div>
        {this.renderQueryType()}
      </>
    );
  }
}

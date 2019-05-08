import React, { PureComponent } from 'react';
import { VariableQueryProps } from 'app/types/plugins';
import { Select, FormLabel, SelectOptionItem } from '@grafana/ui';
import { MetricFindQueryTypes } from '../types';
import { FieldsQueryForm } from './FieldsQueryForm';
import { TermsQueryForm } from './TermsQueryForm';

export interface VariableQueryState {
  find: string;
  fields?: Array<SelectOptionItem<string>>;
  initialQuery?: any;
}

const queryTypes: Array<SelectOptionItem<MetricFindQueryTypes>> = [
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
    const fields = await this.getFields();

    this.setState({
      fields,
    });
  }

  async getFields(): Promise<Array<SelectOptionItem<string>>> {
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

  onQueryTypeChange = (item: SelectOptionItem<MetricFindQueryTypes>) => {
    this.setState({
      find: item.value,
    });
  };

  onQueryChange = (query: any, definition: string) => {
    const jsonQuery = JSON.stringify(query);
    this.props.onChange(jsonQuery, definition);
  };

  renderQueryType() {
    const { templateSrv } = this.props;
    const { find, initialQuery, fields } = this.state;
    const variables = templateSrv.variables;

    switch (find) {
      case MetricFindQueryTypes.Fields:
        return <FieldsQueryForm query={initialQuery} variables={variables} onChange={this.onQueryChange} />;
      case MetricFindQueryTypes.Terms:
        return (
          <TermsQueryForm query={initialQuery} fields={fields} variables={variables} onChange={this.onQueryChange} />
        );
    }

    return '';
  }

  render() {
    const { find } = this.state;

    return (
      <>
        <div className="form-field">
          <FormLabel>Query Type</FormLabel>
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

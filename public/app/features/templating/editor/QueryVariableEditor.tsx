import React, { ChangeEvent, PureComponent } from 'react';
import { e2e } from '@grafana/e2e';
import { FormLabel } from '@grafana/ui';

import templateSrv from '../template_srv';
import { SelectionOptionsEditor } from './SelectionOptionsEditor';
import { QueryVariableModel, VariableRefresh, VariableSort } from '../variable';
import { VariableEditorProps } from '../state/types';
import { QueryVariableEditorState } from '../state/queryVariableReducer';
import { dispatch } from '../../../store/store';
import { changeQueryVariableDataSource, initQueryVariableEditor } from '../state/queryVariableActions';
import { variableAdapters } from '../adapters';

export interface Props extends VariableEditorProps<QueryVariableModel, QueryVariableEditorState> {}
export interface State {
  regex: string | null;
}

export class QueryVariableEditor extends PureComponent<Props, State> {
  state: State = {
    regex: null,
  };

  componentDidMount(): void {
    dispatch(initQueryVariableEditor(this.props.variable));
  }

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.variable.datasource !== this.props.variable.datasource) {
      dispatch(changeQueryVariableDataSource(this.props.variable, this.props.variable.datasource));
    }
  }

  getSelectedDataSourceValue = () => {
    if (!this.props.dataSources.length) {
      return '';
    }
    const foundItem = this.props.dataSources.find(ds => ds.value === this.props.variable.datasource);
    return foundItem ? foundItem.value : this.props.dataSources[0].value;
  };

  onDataSourceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    this.props.onPropChange('query', '');
    this.props.onPropChange('datasource', event.target.value);
  };

  onQueryChange = async (query: any, definition: string) => {
    this.props.onPropChange('query', query);
    this.props.onPropChange('definition', definition);
    await variableAdapters.get(this.props.variable.type).updateOptions(this.props.variable);
  };

  onRegExChange = async (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ regex: event.target.value });
  };

  onRegExBlur = async (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange('regex', event.target.value);
    await variableAdapters.get(this.props.variable.type).updateOptions(this.props.variable);
  };

  onRefreshChange = (event: ChangeEvent<HTMLSelectElement>) => {
    this.props.onPropChange('refresh', event.target.value);
  };

  onSortChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    this.props.onPropChange('sort', parseInt(event.target.value, 10));
    await variableAdapters.get(this.props.variable.type).updateOptions(this.props.variable);
  };

  render() {
    const { VariableQueryEditor } = this.props.editor;
    return (
      <>
        <div className="gf-form-group">
          <h5 className="section-heading">Query Options</h5>
          <div className="gf-form-inline">
            <div className="gf-form max-width-21">
              <span className="gf-form-label width-10">Data source</span>
              <div className="gf-form-select-wrapper max-width-14">
                <select
                  className="gf-form-input"
                  value={this.getSelectedDataSourceValue()}
                  onChange={this.onDataSourceChange}
                  required
                  aria-label={
                    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.selectors.queryOptionsDataSourceSelect
                  }
                >
                  <option value={''} label="">
                    {''}
                  </option>
                  {this.props.dataSources.length &&
                    this.props.dataSources.map(ds => (
                      <option key={ds.value} value={ds.value} label={ds.name}>
                        {ds.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="gf-form max-width-22">
              <FormLabel width={10} tooltip={'When to update the values of this variable.'}>
                Refresh
              </FormLabel>
              <div className="gf-form-select-wrapper width-15">
                <select
                  className="gf-form-input"
                  value={this.props.variable.refresh}
                  onChange={this.onRefreshChange}
                  aria-label={
                    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.selectors.queryOptionsRefreshSelect
                  }
                >
                  <option label="Never" value={VariableRefresh.never}>
                    Never
                  </option>
                  <option label="On Dashboard Load" value={VariableRefresh.onDashboardLoad}>
                    On Dashboard Load
                  </option>
                  <option label="On Time Range Change" value={VariableRefresh.onTimeRangeChanged}>
                    On Time Range Change
                  </option>
                </select>
              </div>
            </div>
          </div>

          {VariableQueryEditor && (
            <VariableQueryEditor
              datasource={this.props.editor.dataSource}
              query={this.props.variable.query}
              templateSrv={templateSrv}
              onChange={this.onQueryChange}
            />
          )}

          <div className="gf-form">
            <FormLabel
              width={10}
              tooltip={'Optional, if you want to extract part of a series name or metric node segment.'}
            >
              Regex
            </FormLabel>
            <input
              type="text"
              className="gf-form-input"
              placeholder="/.*-(.*)-.*/"
              value={this.state.regex ?? this.props.variable.regex}
              onChange={this.onRegExChange}
              onBlur={this.onRegExBlur}
              aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.selectors.queryOptionsRegExInput}
            />
          </div>
          <div className="gf-form max-width-21">
            <FormLabel width={10} tooltip={'How to sort the values of this variable.'}>
              Sort
            </FormLabel>
            <div className="gf-form-select-wrapper max-width-14">
              <select
                className="gf-form-input"
                value={this.props.variable.sort}
                onChange={this.onSortChange}
                aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.selectors.queryOptionsSortSelect}
              >
                <option label="Disabled" value={VariableSort.disabled}>
                  Disabled
                </option>
                <option label="Alphabetical (asc)" value={VariableSort.alphabeticalAsc}>
                  Alphabetical (asc)
                </option>
                <option label="Alphabetical (desc)" value={VariableSort.alphabeticalDesc}>
                  Alphabetical (desc)
                </option>
                <option label="Numerical (asc)" value={VariableSort.numericalAsc}>
                  Numerical (asc)
                </option>
                <option label="Numerical (desc)" value={VariableSort.numericalDesc}>
                  Numerical (desc)
                </option>
                <option
                  label="Alphabetical (case-insensitive, asc)"
                  value={VariableSort.alphabeticalCaseInsensitiveAsc}
                >
                  Alphabetical (case-insensitive, asc)
                </option>
                <option
                  label="Alphabetical (case-insensitive, desc)"
                  value={VariableSort.alphabeticalCaseInsensitiveDesc}
                >
                  Alphabetical (case-insensitive, desc)
                </option>
              </select>
            </div>
          </div>
        </div>

        <SelectionOptionsEditor variable={this.props.variable} />
      </>
    );
  }
}

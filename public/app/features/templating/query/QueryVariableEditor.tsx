import React, { ChangeEvent, PureComponent } from 'react';
import { e2e } from '@grafana/e2e';
import { FormLabel, Switch } from '@grafana/ui';

import templateSrv from '../template_srv';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { QueryVariableModel, VariableRefresh, VariableSort, VariableWithMultiSupport } from '../variable';
import { VariableEditorProps } from '../state/types';
import { QueryVariableEditorState } from './reducer';
import { dispatch } from '../../../store/store';
import { changeQueryVariableDataSource, initQueryVariableEditor } from './actions';
import { variableAdapters } from '../adapters';

export interface Props extends VariableEditorProps<QueryVariableModel, QueryVariableEditorState> {}
export interface State {
  regex: string | null;
  tagsQuery: string | null;
  tagValuesQuery: string | null;
}

export class QueryVariableEditor extends PureComponent<Props, State> {
  state: State = {
    regex: null,
    tagsQuery: null,
    tagValuesQuery: null,
  };

  componentDidMount(): void {
    dispatch(initQueryVariableEditor(this.props.variable));
  }

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.variable.datasource !== this.props.variable.datasource) {
      dispatch(changeQueryVariableDataSource(this.props.variable, this.props.variable.datasource));
    }
  }

  getSelectedDataSourceValue = (): string => {
    if (!this.props.dataSources.length) {
      return '';
    }
    const foundItem = this.props.dataSources.find(ds => ds.value === this.props.variable.datasource);
    const value = foundItem ? foundItem.value : this.props.dataSources[0].value;
    return value ?? '';
  };

  runQuery = async () => await variableAdapters.get(this.props.variable.type).updateOptions(this.props.variable);

  onDataSourceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    this.props.onPropChange('query', '');
    this.props.onPropChange('datasource', event.target.value);
  };

  onQueryChange = async (query: any, definition: string) => {
    this.props.onPropChange('query', query);
    this.props.onPropChange('definition', definition);
    await this.runQuery();
  };

  onRegExChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ regex: event.target.value });
  };

  onRegExBlur = async (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange('regex', event.target.value);
    await this.runQuery();
  };

  onTagsQueryChange = async (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ tagsQuery: event.target.value });
  };

  onTagsQueryBlur = async (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange('tagsQuery', event.target.value);
    await this.runQuery();
  };

  onTagValuesQueryChange = async (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ tagValuesQuery: event.target.value });
  };

  onTagValuesQueryBlur = async (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange('tagValuesQuery', event.target.value);
    await this.runQuery();
  };

  onRefreshChange = (event: ChangeEvent<HTMLSelectElement>) => {
    this.props.onPropChange('refresh', parseInt(event.target.value, 10));
  };

  onSortChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    this.props.onPropChange('sort', parseInt(event.target.value, 10));
    await this.runQuery();
  };

  onSelectionOptionsChange = async (propName: keyof VariableWithMultiSupport, propValue: any) => {
    this.props.onPropChange(propName, propValue);
    await this.runQuery();
  };

  onUseTagsChange = async (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange('useTags', event.target.checked);
    await this.runQuery();
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
                  {this.props.dataSources.length &&
                    this.props.dataSources.map(ds => (
                      <option key={ds.value ?? ''} value={ds.value ?? ''} label={ds.name}>
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

          {VariableQueryEditor && this.props.editor.dataSource && (
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

        <SelectionOptionsEditor variable={this.props.variable} onPropChange={this.onSelectionOptionsChange} />

        <div className="gf-form-group">
          <h5>Value groups/tags (Experimental feature)</h5>
          <div
            aria-label={
              e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.selectors.valueGroupsTagsEnabledSwitch
            }
          >
            <Switch
              label="Enabled"
              label-class="width-10"
              checked={this.props.variable.useTags}
              onChange={this.onUseTagsChange}
            />
          </div>
          {this.props.variable.useTags && (
            <>
              <div className="gf-form last">
                <span className="gf-form-label width-10">Tags query</span>
                <input
                  type="text"
                  className="gf-form-input"
                  value={this.state.tagsQuery ?? this.props.variable.tagsQuery}
                  placeholder="metric name or tags query"
                  onChange={this.onTagsQueryChange}
                  onBlur={this.onTagsQueryBlur}
                  aria-label={
                    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.selectors.valueGroupsTagsTagsQueryInput
                  }
                />
              </div>
              <div className="gf-form">
                <li className="gf-form-label width-10">Tag values query</li>
                <input
                  type="text"
                  className="gf-form-input"
                  value={this.state.tagValuesQuery ?? this.props.variable.tagValuesQuery}
                  placeholder="apps.$tag.*"
                  onChange={this.onTagValuesQueryChange}
                  onBlur={this.onTagValuesQueryBlur}
                  aria-label={
                    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.selectors
                      .valueGroupsTagsTagsValuesQueryInput
                  }
                />
              </div>
            </>
          )}
        </div>
      </>
    );
  }
}

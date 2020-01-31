import React, { ChangeEvent, PureComponent } from 'react';
import { e2e } from '@grafana/e2e';
import { FormLabel } from '@grafana/ui';

import templateSrv from '../template_srv';
import { SelectionOptionsEditor } from './SelectionOptionsEditor';
import { QueryVariableModel } from '../variable';
import { VariableEditorProps } from '../state/types';
import { QueryVariableEditorState } from '../state/queryVariableReducer';
import { dispatch } from '../../../store/store';
import { changeQueryVariableDataSource, initQueryVariableEditor } from '../state/queryVariableActions';
import { variableAdapters } from '../adapters';

export interface Props extends VariableEditorProps<QueryVariableModel, QueryVariableEditorState> {}

export class QueryVariableEditor extends PureComponent<Props> {
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
                  // ng-model="current.refresh"
                  // ng-options="f.value as f.text for f in refreshOptions"
                  aria-label={
                    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.selectors.queryOptionsRefreshSelect
                  }
                >
                  {/*{}*/}
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
              // ng-model="current.regex"
              placeholder="/.*-(.*)-.*/"
              // ng-model-onblur
              // ng-change="runQuery()"
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
                // ng-model="current.sort"
                // ng-options="f.value as f.text for f in sortOptions"
                // ng-change="runQuery()"
                aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.selectors.queryOptionsSortSelect}
              >
                {/*{}*/}
              </select>
            </div>
          </div>
        </div>

        <SelectionOptionsEditor variable={this.props.variable} />
      </>
    );
  }
}

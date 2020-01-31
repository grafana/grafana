import React, { PureComponent } from 'react';
import { QueryVariableState } from '../state/queryVariableReducer';
import { e2e } from '@grafana/e2e';
import { FormLabel } from '@grafana/ui';
import { SelectionOptionsEditor } from './SelectionOptionsEditor';

export interface Props extends QueryVariableState {}

export class QueryVariableEditor extends PureComponent<Props> {
  render() {
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
                  // ng-model="current.datasource"
                  // ng-options="f.value as f.name for f in datasources"
                  // ng-change="datasourceChanged()"
                  required
                  aria-label={
                    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.selectors.queryOptionsDataSourceSelect
                  }
                >
                  {/*{}*/}
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

          {/*<rebuild-on-change property="currentDatasource">*/}
          {/*  <variable-query-editor-loader></variable-query-editor-loader>*/}
          {/*</rebuild-on-change>*/}

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

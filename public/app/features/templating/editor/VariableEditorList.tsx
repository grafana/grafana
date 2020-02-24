import React, { MouseEvent, PureComponent } from 'react';
import { VariableState } from '../state/types';
import { e2e } from '@grafana/e2e';
import EmptyListCTA from '../../../core/components/EmptyListCTA/EmptyListCTA';
import { QueryVariableModel } from '../variable';
import { VariableIdentifier } from '../state/actions';

export interface Props {
  variableStates: VariableState[];
  onAddClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  onEditClick: (args: VariableIdentifier) => void;
}

export class VariableEditorList extends PureComponent<Props> {
  onEditClick = (event: MouseEvent, args: VariableIdentifier) => {
    event.preventDefault();
    this.props.onEditClick(args);
  };

  render() {
    return (
      <div>
        <div>
          {this.props.variableStates.length === 0 && (
            <div>
              <EmptyListCTA
                title="There are no variables yet"
                buttonIcon="gicon gicon-variable"
                buttonTitle="Add variable"
                infoBox={{
                  __html: ` <p>
                    Variables enable more interactive and dynamic dashboards. Instead of hard-coding things like server
                    or sensor names in your metric queries you can use variables in their place. Variables are shown as
                    dropdown select boxes at the top of the dashboard. These dropdowns make it easy to change the data
                    being displayed in your dashboard. Check out the
                    <a class="external-link" href="http://docs.grafana.org/reference/templating/" target="_blank">
                      Templating documentation
                    </a>
                    for more information.
                  </p>`,
                }}
                infoBoxTitle="What do variables do?"
                onClick={this.props.onAddClick}
              />
            </div>
          )}

          {this.props.variableStates.length > 0 && (
            <div>
              <table
                className="filter-table filter-table--hover"
                aria-label={e2e.pages.Dashboard.Settings.Variables.List.selectors.table}
              >
                <thead>
                  <tr>
                    <th>Variable</th>
                    <th>Definition</th>
                    <th colSpan={5} />
                  </tr>
                </thead>
                <tbody>
                  {this.props.variableStates.map((state, index) => {
                    const variable = state.variable as QueryVariableModel;
                    return (
                      <tr key={variable.name}>
                        <td style={{ width: '1%' }}>
                          <span
                            onClick={event => this.onEditClick(event, { type: variable.type, uuid: variable.uuid })}
                            className="pointer template-variable"
                            aria-label={e2e.pages.Dashboard.Settings.Variables.List.selectors.tableRowNameFields(
                              variable.name
                            )}
                          >
                            {variable.name}
                          </span>
                        </td>
                        <td
                          style={{ maxWidth: '200px' }}
                          onClick={event => this.onEditClick(event, { type: variable.type, uuid: variable.uuid })}
                          className="pointer max-width"
                          aria-label={e2e.pages.Dashboard.Settings.Variables.List.selectors.tableRowDefinitionFields(
                            variable.name
                          )}
                        >
                          {variable.definition ? variable.definition : variable.query}
                        </td>

                        <td style={{ width: '1%' }}>
                          {index > 0 && (
                            <i
                              // ng-click="_.move(variables,$index,$index-1)"
                              // ng-hide="$first"
                              className="pointer fa fa-arrow-up"
                              aria-label={e2e.pages.Dashboard.Settings.Variables.List.selectors.tableRowArrowUpButtons(
                                variable.name
                              )}
                            />
                          )}
                        </td>
                        <td style={{ width: '1%' }}>
                          {index < this.props.variableStates.length - 1 && (
                            <i
                              // ng-click="_.move(variables,$index,$index+1)"
                              // ng-hide="$last"
                              className="pointer fa fa-arrow-down"
                              aria-label={e2e.pages.Dashboard.Settings.Variables.List.selectors.tableRowArrowDownButtons(
                                variable.name
                              )}
                            />
                          )}
                        </td>
                        <td style={{ width: '1%' }}>
                          <a
                            // ng-click="duplicate(variable)"
                            className="btn btn-inverse btn-small"
                            aria-label={e2e.pages.Dashboard.Settings.Variables.List.selectors.tableRowDuplicateButtons(
                              variable.name
                            )}
                          >
                            Duplicate
                          </a>
                        </td>
                        <td style={{ width: '1%' }}>
                          <a
                            // ng-click="removeVariable(variable)"
                            className="btn btn-danger btn-small"
                            aria-label={e2e.pages.Dashboard.Settings.Variables.List.selectors.tableRowRemoveButtons(
                              variable.name
                            )}
                          >
                            <i className="fa fa-remove" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }
}

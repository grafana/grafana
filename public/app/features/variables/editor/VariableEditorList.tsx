import React, { MouseEvent, PureComponent } from 'react';
import { e2e } from '@grafana/e2e';
import EmptyListCTA from '../../../core/components/EmptyListCTA/EmptyListCTA';
import { QueryVariableModel, VariableModel } from '../../templating/types';
import { toVariableIdentifier, VariableIdentifier } from '../state/types';

export interface Props {
  variables: VariableModel[];
  onAddClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  onEditClick: (identifier: VariableIdentifier) => void;
  onChangeVariableOrder: (identifier: VariableIdentifier, fromIndex: number, toIndex: number) => void;
  onDuplicateVariable: (identifier: VariableIdentifier) => void;
  onRemoveVariable: (identifier: VariableIdentifier) => void;
}

enum MoveType {
  down = 1,
  up = -1,
}

export class VariableEditorList extends PureComponent<Props> {
  onEditClick = (event: MouseEvent, identifier: VariableIdentifier) => {
    event.preventDefault();
    this.props.onEditClick(identifier);
  };

  onChangeVariableOrder = (event: MouseEvent, variable: VariableModel, moveType: MoveType) => {
    event.preventDefault();
    this.props.onChangeVariableOrder(toVariableIdentifier(variable), variable.index!, variable.index! + moveType);
  };

  onDuplicateVariable = (event: MouseEvent, identifier: VariableIdentifier) => {
    event.preventDefault();
    this.props.onDuplicateVariable(identifier);
  };

  onRemoveVariable = (event: MouseEvent, identifier: VariableIdentifier) => {
    event.preventDefault();
    this.props.onRemoveVariable(identifier);
  };

  render() {
    return (
      <div>
        <div>
          {this.props.variables.length === 0 && (
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

          {this.props.variables.length > 0 && (
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
                  {this.props.variables.map((state, index) => {
                    const variable = state as QueryVariableModel;
                    return (
                      <tr key={`${variable.name}-${index}`}>
                        <td style={{ width: '1%' }}>
                          <span
                            onClick={event => this.onEditClick(event, toVariableIdentifier(variable))}
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
                          onClick={event => this.onEditClick(event, toVariableIdentifier(variable))}
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
                              onClick={event => this.onChangeVariableOrder(event, variable, MoveType.up)}
                              className="pointer fa fa-arrow-up"
                              aria-label={e2e.pages.Dashboard.Settings.Variables.List.selectors.tableRowArrowUpButtons(
                                variable.name
                              )}
                            />
                          )}
                        </td>
                        <td style={{ width: '1%' }}>
                          {index < this.props.variables.length - 1 && (
                            <i
                              onClick={event => this.onChangeVariableOrder(event, variable, MoveType.down)}
                              className="pointer fa fa-arrow-down"
                              aria-label={e2e.pages.Dashboard.Settings.Variables.List.selectors.tableRowArrowDownButtons(
                                variable.name
                              )}
                            />
                          )}
                        </td>
                        <td style={{ width: '1%' }}>
                          <a
                            onClick={event => this.onDuplicateVariable(event, toVariableIdentifier(variable))}
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
                            onClick={event => this.onRemoveVariable(event, toVariableIdentifier(variable))}
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

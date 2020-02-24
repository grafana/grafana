import React, { PureComponent } from 'react';
import { VariableState } from '../state/types';
import { StoreState } from '../../../types';
import { Observable, Subscriber, Subscription } from 'rxjs';
import { store } from '../../../store/store';
import { distinctUntilChanged } from 'rxjs/operators';
import { e2e } from '@grafana/e2e';
import EmptyListCTA from '../../../core/components/EmptyListCTA/EmptyListCTA';
import { QueryVariableModel } from '../variable';

export interface State {
  variableStates: VariableState[];
}

export class VariableEditorList extends PureComponent<{}, State> {
  private readonly subscription: Subscription | null = null;
  constructor(props: {}) {
    super(props);

    // editing a new variable
    this.subscription = new Observable((observer: Subscriber<State>) => {
      const unsubscribeFromStore = store.subscribe(() => observer.next(this.stateSelector(store.getState())));
      observer.next(this.stateSelector(store.getState()));
      return function unsubscribe() {
        unsubscribeFromStore();
      };
    })
      .pipe(
        distinctUntilChanged<State>((previous, current) => {
          return previous === current;
        })
      )
      .subscribe({
        next: state => {
          if (this.state) {
            this.setState({ ...state });
            return;
          }

          this.state = state;
        },
      });
  }

  stateSelector = (state: StoreState) => ({ variableStates: Object.values(state.templating.variables) });

  componentWillUnmount(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  render() {
    return (
      <div>
        <div className="page-action-bar">
          <h3 className="dashboard-settings__header">
            <a
              // ng-click="setMode('list')"
              aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.headerLink}
            >
              Variables
            </a>
            <span
            // ng-show="mode === 'new'"
            >
              <i
                className="fa fa-fw fa-chevron-right"
                aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.modeLabelNew}
              />
              New
            </span>
            <span
            // ng-show="mode === 'edit'"
            >
              <i
                className="fa fa-fw fa-chevron-right"
                aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.modeLabelEdit}
              />
              Edit
            </span>
          </h3>

          <div className="page-action-bar__spacer" />
          <a
            type="button"
            className="btn btn-primary"
            // ng-click="setMode('new');"
            // ng-if="variables.length > 0"
            // ng-hide="mode === 'edit' || mode === 'new'"
            aria-label={e2e.pages.Dashboard.Settings.Variables.List.selectors.newButton}
          >
            New
          </a>
        </div>
        <div
        // ng-if="mode === 'list'"
        >
          {this.state.variableStates.length === 0 && (
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
                    <a className="external-link" href="http://docs.grafana.org/reference/templating/" target="_blank">
                      Templating documentation
                    </a>
                    for more information.
                  </p>`,
                }}
                infoBoxTitle="What do variables do?"
              />
              {/*<empty-list-cta*/}
              {/*  on-click="setNewMode"*/}
              {/*  title="emptyListCta.title"*/}
              {/*  infoBox="emptyListCta.infoBox"*/}
              {/*  infoBoxTitle="emptyListCta.infoBoxTitle"*/}
              {/*  buttonTitle="emptyListCta.buttonTitle"*/}
              {/*  buttonIcon="emptyListCta.buttonIcon"*/}
              {/*/>*/}
            </div>
          )}

          {this.state.variableStates.length > 0 && (
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
                  {this.state.variableStates.map((state, index) => {
                    const variable = state.variable as QueryVariableModel;
                    return (
                      <tr
                        key={variable.name}
                        // ng-repeat="variable in variables"
                      >
                        <td style={{ width: '1%' }}>
                          <span
                            // ng-click="edit(variable)"
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
                          // ng-click="edit(variable)"
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
                          {index < this.state.variableStates.length - 1 && (
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

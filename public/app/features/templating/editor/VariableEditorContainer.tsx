import React, { PureComponent } from 'react';
import { VariableState } from '../state/types';
import { StoreState } from '../../../types';
import { Observable, Subscriber, Subscription } from 'rxjs';
import { store } from '../../../store/store';
import { distinctUntilChanged } from 'rxjs/operators';
import { e2e } from '@grafana/e2e';
import { VariableEditorList } from './VariableEditorList';

export interface State {
  variableStates: VariableState[];
}

export class VariableEditorContainer extends PureComponent<{}, State> {
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
        <VariableEditorList variableStates={this.state.variableStates} />
      </div>
    );
  }
}

import React, { MouseEvent, PureComponent } from 'react';
import { emptyUuid, VariableState } from '../state/types';
import { StoreState } from '../../../types';
import { Observable, Subscriber, Subscription } from 'rxjs';
import { dispatch, store } from '../../../store/store';
import { distinctUntilChanged } from 'rxjs/operators';
import { e2e } from '@grafana/e2e';
import { VariableEditorList } from './VariableEditorList';
import { VariableEditorEditor } from './VariableEditorEditor';
import {
  changeToEditorEditMode,
  changeToEditorListMode,
  toVariablePayload,
  VariableIdentifier,
} from '../state/actions';
import { VariableModel } from '../variable';

export interface State {
  uuidInEditor: string | null;
  variableStates: VariableState[];
}

export class VariableEditorContainer extends PureComponent<{}, State> {
  private readonly subscription: Subscription | null = null;
  constructor(props: {}) {
    super(props);

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

  stateSelector = (state: StoreState) => ({
    variableStates: Object.values(state.templating.variables),
    uuidInEditor: state.templating.uuidInEditor,
  });

  componentDidMount(): void {
    dispatch(changeToEditorListMode(toVariablePayload({ uuid: null, type: 'query' } as VariableModel)));
  }

  componentWillUnmount(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  onChangeToListMode = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    dispatch(changeToEditorListMode(toVariablePayload({ uuid: null, type: 'query' } as VariableModel)));
  };

  onEditVariable = (identifier: VariableIdentifier) => {
    dispatch(
      changeToEditorEditMode(toVariablePayload({ uuid: identifier.uuid, type: identifier.type } as VariableModel))
    );
  };

  onChangeToAddMode = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    dispatch(changeToEditorEditMode(toVariablePayload({ uuid: emptyUuid, type: 'query' } as VariableModel)));
  };

  render() {
    const variableStateToEdit =
      this.state.variableStates.find(s => s.variable.uuid === this.state.uuidInEditor) ?? null;
    return (
      <div>
        <div className="page-action-bar">
          <h3 className="dashboard-settings__header">
            <a
              onClick={this.onChangeToListMode}
              aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.headerLink}
            >
              Variables
            </a>
            {this.state.uuidInEditor === emptyUuid && (
              <span>
                <i
                  className="fa fa-fw fa-chevron-right"
                  aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.modeLabelNew}
                />
                New
              </span>
            )}
            {this.state.uuidInEditor && this.state.uuidInEditor !== emptyUuid && (
              <span>
                <i
                  className="fa fa-fw fa-chevron-right"
                  aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.modeLabelEdit}
                />
                Edit
              </span>
            )}
          </h3>

          <div className="page-action-bar__spacer" />
          {this.state.variableStates.length > 0 && variableStateToEdit === null && (
            <a
              type="button"
              className="btn btn-primary"
              onClick={this.onChangeToAddMode}
              aria-label={e2e.pages.Dashboard.Settings.Variables.List.selectors.newButton}
            >
              New
            </a>
          )}
        </div>

        {!variableStateToEdit && (
          <VariableEditorList
            variableStates={this.state.variableStates}
            onAddClick={this.onChangeToAddMode}
            onEditClick={this.onEditVariable}
          />
        )}
        {variableStateToEdit && (
          <VariableEditorEditor
            picker={variableStateToEdit.picker}
            editor={variableStateToEdit.editor}
            variable={variableStateToEdit.variable}
          />
        )}
      </div>
    );
  }
}

import { ActionId, CommandSrv, Action } from '@grafana/runtime';
import { Observable, Subject } from 'rxjs';
import { isArray } from 'lodash';
import store from 'app/core/store';
import { ActionImpl } from 'kbar';

export class CommandService implements CommandSrv {
  recentActionsKey = 'recent_actions';
  actions: Record<ActionId, Action> = {};
  subject: Subject<Action[]>;

  constructor() {
    this.subject = new Subject();
  }

  getAction(actionId: ActionId): Action | undefined {
    return this.actions[actionId];
  }

  getAllActions(): Action[] {
    return Object.values(this.actions);
  }

  registerAction(action: Action): void {
    console.log('CommandService: registering action', action);

    const perform = action.perform;
    if (perform) {
      action.perform = (actionImpl: any) => {
        this.addRecentAction(actionImpl);
        return perform(actionImpl);
      };
    }

    this.actions[action.id] = action;
    this.subject.next(this.getAllActions());
  }

  unregisterAction(actionId: ActionId): Action | undefined {
    const action = this.actions[actionId];
    if (action) {
      const newActions = {
        ...this.actions,
      };
      delete newActions[actionId];
      this.actions = newActions;
      this.subject.next(this.getAllActions());
      return action;
    }
    return undefined;
  }

  getActionsObservable(): Observable<Action[]> {
    return this.subject.asObservable();
  }

  addRecentAction(action: ActionImpl) {
    let actionId = action.id;
    if (action.ancestors.length > 0) {
      actionId = action.ancestors[0].id;
    }

    let recentActions = [];
    if (store.exists(this.recentActionsKey)) {
      recentActions = JSON.parse(store.get(this.recentActionsKey));
      if (!isArray(recentActions)) {
        recentActions = [];
      }
    }

    recentActions = recentActions.filter((id) => {
      return actionId !== id;
    });

    recentActions.unshift(actionId);

    if (recentActions.length > 20) {
      recentActions.pop();
    }
    store.set(this.recentActionsKey, JSON.stringify(recentActions));
  }

  getRecentActions(): string[] {
    let recentActions = store.get(this.recentActionsKey) || '[]';
    return JSON.parse(recentActions);
  }
}

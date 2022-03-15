import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isEqual } from 'lodash';
import { Observable } from 'rxjs';

export type ActionId = string;

export type Action = {
  id: ActionId;
  name: string;
  shortcut?: string[];
  keywords?: string;
  section?: string;
  icon?: string | React.ReactElement | React.ReactNode;
  subtitle?: string;
  perform?: (currentActionImpl: any) => any;
  hide?: () => boolean;
  parent?: ActionId;
  isEnterprise?: boolean;
};

/**
 * @public
 */
export interface CommandSrv {
  /**
   * Makes action available in the command palette.
   */
  registerAction(action: Action): void;

  /**
   * Removes action from command palette.
   */
  unregisterAction(actionId: ActionId): Action | undefined;

  getAction(actionId: ActionId): Action | undefined;
  getAllActions(): Action[];

  /**
   * Get user recent actions (array of string IDs).
   */
  getRecentActions(): string[];

  /**
   * Get observable that will emit on all the actions whenever something changes
   */
  getActionsObservable(): Observable<Action[]>;
}

let singletonInstance: CommandSrv;

/**
 * @internal
 */
export function setCommandSrv(instance: CommandSrv) {
  singletonInstance = instance;
}

/**
 * @public
 */
export function getCommandSrv(): CommandSrv {
  return singletonInstance;
}

/**
 * Register action in command palette, useful for dynamically register actions that should be available only in case
 * a particular component is visible. Makes sure action is unregistered on unmount.
 * @param action
 */
export function useRegisterAction(action: Action) {
  useEffect(() => {
    getCommandSrv().registerAction(action);
    return () => {
      getCommandSrv().unregisterAction(action.id);
    };
  }, [action]);
}

/**
 * Component that has the same function as useRegisterAction but useful in context of class component.
 * @param action
 */
export function CommandAction({ action }: { action: Action }) {
  const actionCache = useRef(action);
  const cached = useMemo(() => {
    // Does not work with functions anyway so not sure if makes sense to cache this. Or just use some different equals
    // func.
    if (isEqual(actionCache.current, action)) {
      return actionCache.current;
    } else {
      actionCache.current = action;
      return action;
    }
  }, [action]);
  useRegisterAction(cached);
  return null;
}

/**
 * Returns list of actions every time it changes inside the service.
 */
export function useActions() {
  const cmdSrv = getCommandSrv();
  const [actions, setActions] = useState<Action[]>(cmdSrv.getAllActions());
  useEffect(() => {
    const subscription = cmdSrv.getActionsObservable().subscribe((actions) => {
      setActions(actions);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [cmdSrv]);
  return actions;
}

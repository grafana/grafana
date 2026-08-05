import { type ComponentType } from 'react';

export interface PromoteSharedVariablesProps {
  /** Called after a successful promote so the list can refetch. */
  onCompleted: () => void;
  /** Optional cluster id from Advisor deep-link (?promote=). */
  initialClusterId?: string;
}

let InternalPromoteSharedVariables: ComponentType<PromoteSharedVariablesProps> | null = null;

export function registerPromoteSharedVariables(component: ComponentType<PromoteSharedVariablesProps>) {
  InternalPromoteSharedVariables = component;
}

export function getPromoteSharedVariables(): ComponentType<PromoteSharedVariablesProps> | null {
  return InternalPromoteSharedVariables;
}

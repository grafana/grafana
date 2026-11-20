import { type ComponentType } from 'react';

let InternalSharedVariablesEntryPoint: ComponentType | null = null;

/**
 * Registers the Variables page's entry point to the shared variables migration tool, an
 * Enterprise feature. It renders in the page header and decides for itself whether the
 * viewer can use the tool.
 */
export function registerSharedVariablesEntryPoint(component: ComponentType | null) {
  InternalSharedVariablesEntryPoint = component;
}

export function getSharedVariablesEntryPoint(): ComponentType | null {
  return InternalSharedVariablesEntryPoint;
}

/** Renders the registered entry point, or nothing until Enterprise registers one. */
export function SharedVariablesEntryPoint() {
  const EntryPoint = InternalSharedVariablesEntryPoint;
  return EntryPoint ? <EntryPoint /> : null;
}

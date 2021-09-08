import { DataQuery } from '@grafana/data';

export interface CreateActionComponentProps {
  onAddQuery?: (q: Partial<DataQuery>) => void;
}

export type CreateActionComponent = React.ComponentType<CreateActionComponentProps>;

let extraRenderCreateActions: CreateActionComponent[] = [];

/**
 * @internal and experimental
 */
export function addExtraRenderCreateAction(extra: CreateActionComponent) {
  extraRenderCreateActions = extraRenderCreateActions.concat(extra);
}
/**
 * @internal and experimental
 */
export function getAllExtraRenderCreateAction(): CreateActionComponent[] {
  return extraRenderCreateActions;
}

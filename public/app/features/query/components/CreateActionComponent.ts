export type CreateActionComponent = React.ComponentType;

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

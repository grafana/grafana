export type CreateActionComponent = React.ComponentType;

let extraRenderCreateActions: CreateActionComponent[] = [];

export function addExtraRenderCreateAction(extra: CreateActionComponent) {
  extraRenderCreateActions = extraRenderCreateActions.concat(extra);
}

export function getAllExtraRenderCreateAction(): CreateActionComponent[] {
  return extraRenderCreateActions;
}

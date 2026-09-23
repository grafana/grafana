// First save and Save as copy load a new scene. Preserve the presentation choice only
// for that navigation, without turning it into a persistent dashboard preference.
let pendingPresentation: { uid: string; presentation: 'preview' | 'full' } | undefined;

export function setEditPresentationAfterSave(uid: string, presentation: 'preview' | 'full') {
  pendingPresentation = { uid, presentation };
}

export function consumeEditPresentationAfterSave(uid: string): 'preview' | 'full' | undefined {
  const presentation = pendingPresentation?.uid === uid ? pendingPresentation.presentation : undefined;
  pendingPresentation = undefined;
  return presentation;
}

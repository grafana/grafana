import { scopesSelectorScene } from './instance';

export function ScopesSelector() {
  if (!scopesSelectorScene) {
    return null;
  }

  return <scopesSelectorScene.Component model={scopesSelectorScene} />;
}

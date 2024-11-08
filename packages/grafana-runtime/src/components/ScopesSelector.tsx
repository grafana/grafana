import { getScopesSelector } from '../services';

export function ScopesSelector() {
  const scopesSelectorScene = getScopesSelector();

  if (!scopesSelectorScene) {
    return null;
  }

  return <scopesSelectorScene.Component model={scopesSelectorScene} />;
}

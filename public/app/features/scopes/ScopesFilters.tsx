import { scopesFiltersScene } from './instance';

export function ScopesFilters() {
  if (!scopesFiltersScene) {
    return null;
  }

  return <scopesFiltersScene.Component model={scopesFiltersScene} />;
}

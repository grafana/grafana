import { useMemo } from 'react';

import { CardGridProps } from 'app/features/connections/components';
import { ROUTES } from 'app/features/connections/constants';

import { PluginRecipe } from '../types';

// TODO: remove this, or load it from the public/ folder
const DEFAULT_LOGO = 'https://grafana.com/api/plugins/simpod-json-datasource/versions/0.5.0/logos/small';

export function useRecipesFilteredBySearch(
  recipes: PluginRecipe[] | undefined,
  searchTerm: string | undefined
): CardGridProps['items'] {
  return useMemo(() => {
    const source = recipes || [];
    const result = [];

    for (const recipe of source) {
      // No search term, show all
      if (!searchTerm) {
        result.push({
          id: recipe.id,
          name: recipe.name,
          logo: recipe.logo || DEFAULT_LOGO,
          url: ROUTES.PluginRecipeDetails.replace(':id', recipe.id),
        });
        continue;
      }

      // Only show if it matches the search term
      if (recipe.name.toLowerCase().indexOf(searchTerm) > -1) {
        result.push({
          id: recipe.id,
          name: recipe.name,
          logo: recipe.logo || DEFAULT_LOGO,
          url: ROUTES.PluginRecipeDetails.replace(':id', recipe.id),
        });
        continue;
      }
    }

    return result;
  }, [recipes, searchTerm]);
}

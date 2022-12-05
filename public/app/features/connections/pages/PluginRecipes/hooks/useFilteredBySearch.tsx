import { useMemo } from 'react';

import { CardGridProps } from 'app/features/connections/components';
import { ROUTES } from 'app/features/connections/constants';

import { PluginRecipe } from '../types';

export function useRecipesFilteredBySearch(
  recipes: PluginRecipe[] | undefined,
  term: string | undefined
): CardGridProps['items'] {
  return useMemo(() => {
    const source = recipes || [];
    const result = [];

    for (const recipe of source) {
      if (term && recipe.name.indexOf(term) > -1) {
        result.push({
          id: recipe.id,
          name: recipe.name,
          logo: 'https://grafana.com/api/plugins/simpod-json-datasource/versions/0.5.0/logos/small', // Temporary logo, replace later from META data
          url: ROUTES.PluginRecipeDetails.replace(':id', recipe.id),
        });
        continue;
      }

      result.push({
        id: recipe.id,
        name: recipe.name,
        logo: 'https://grafana.com/api/plugins/simpod-json-datasource/versions/0.5.0/logos/small', // Temporary logo, replace later from META data
        url: ROUTES.PluginRecipeDetails.replace(':id', recipe.id),
      });
    }

    return result;
  }, [recipes, term]);
}

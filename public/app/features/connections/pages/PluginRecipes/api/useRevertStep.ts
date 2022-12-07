import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { PluginRecipe } from '../types';

export const useRevertStep = (recipeId: string, stepNumber: number) => {
  return useQuery<PluginRecipe>({
    queryKey: [`plugin-recipes-${recipeId}-${stepNumber}`],
    queryFn: async () => {
      const { data } = await axios.post(`/api/plugin-recipes/${recipeId}/${stepNumber}/revert`);
      return data;
    },
  });
};

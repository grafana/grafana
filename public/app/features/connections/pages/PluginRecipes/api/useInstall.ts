import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { PluginRecipe } from '../types';

export const useInstall = (id: string) => {
  return useQuery<PluginRecipe>({
    queryKey: [`plugin-recipes-${id}`],
    queryFn: async () => {
      const { data } = await axios.post(`/api/plugin-recipes/${id}/install`);
      return data;
    },
  });
};

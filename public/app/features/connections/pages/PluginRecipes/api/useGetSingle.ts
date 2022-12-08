import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { PluginRecipe } from '../types';

export const useGetSingle = (id: string) => {
  return useQuery<PluginRecipe>({
    networkMode: 'always',
    queryKey: [`plugin-recipes-${id}`],
    queryFn: async () => {
      const { data } = await axios.get(`/api/plugin-recipes/${id}`);
      return data;
    },
  });
};

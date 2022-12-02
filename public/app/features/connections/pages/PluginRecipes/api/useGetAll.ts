import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { PluginRecipe } from '../types';

export const useGetAll = () => {
  return useQuery<PluginRecipe[]>({
    queryKey: ['plugin-recipes'],
    queryFn: async () => {
      const { data } = await axios.get('/api/plugin-recipes');
      return data;
    },
  });
};

import { useState, useEffect } from 'react';
import { Org } from '../types';
import { api } from '../api';

interface State {
  isLoading: boolean;
  org?: Org;
}

export const useOrg = (slug: string): State => {
  const [state, setState] = useState<State>({
    isLoading: true,
  });

  useEffect(() => {
    const fetchOrgData = async () => {
      const org = await api.getOrg(slug);
      setState({ org, isLoading: false });
    };
    fetchOrgData();
  }, [slug]);

  return state;
};

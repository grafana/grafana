import { useState, useEffect } from 'react';
import { Org } from '../types';
import API from '../api';

interface State {
  status: 'LOADING' | 'DONE';
  org?: Org;
}

export const useOrg = (slug: string): State => {
  const [state, setState] = useState<State>({
    status: 'LOADING',
  });

  useEffect(() => {
    setState((state) => ({ ...state, status: 'LOADING' }));

    (async () => {
      const api = new API();
      const org = await api.getOrg(slug);
      setState({ org, status: 'DONE' });
    })();
  }, [slug]);

  return state;
};

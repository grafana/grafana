import { useMyContext } from './store';

export const useCustomReducer = () => {
  const { state, dispatch } = useMyContext();
  return { state, dispatch };
};

import { useDispatch, useSelector } from 'react-redux';

import { setDisplayMode } from '../state/reducer';
import { selectDisplayMode } from '../state/selectors';
import { PluginListDisplayMode } from '../types';

export const useDisplayMode = () => {
  const dispatch = useDispatch();
  const displayMode = useSelector(selectDisplayMode);

  return {
    displayMode,
    setDisplayMode: (v: PluginListDisplayMode) => dispatch(setDisplayMode(v)),
  };
};

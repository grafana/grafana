import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { cleanUpAction, StateSelector } from '../actions/cleanUp';

export function useCleanup<T>(stateSelector: StateSelector<T>) {
  const dispatch = useDispatch();
  //bit of a hack to unburden user from having to wrap stateSelcetor in a useCallback. Otherwise cleanup would happen on every render
  const selectorRef = useRef(stateSelector);
  selectorRef.current = stateSelector;
  useEffect(() => {
    return () => {
      dispatch(cleanUpAction({ stateSelector: selectorRef.current }));
    };
  }, [dispatch]);
}

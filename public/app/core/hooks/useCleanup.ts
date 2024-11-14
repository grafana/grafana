import { useEffect, useRef } from 'react';

import { useDispatch } from 'app/types';

import { cleanUpAction, CleanUpAction } from '../actions/cleanUp';

export function useCleanup(cleanupAction: CleanUpAction) {
  const dispatch = useDispatch();
  //bit of a hack to unburden user from having to wrap stateSelcetor in a useCallback. Otherwise cleanup would happen on every render
  const selectorRef = useRef(cleanupAction);
  selectorRef.current = cleanupAction;
  useEffect(() => {
    return () => {
      dispatch(cleanUpAction({ cleanupAction: selectorRef.current }));
    };
  }, [dispatch]);
}

import React, { useCallback } from 'react';

import { Button } from '@grafana/ui';

import { actions } from '../state/actions';
import { useDispatch } from '../state/context';

export function PlayButton() {
  const dispatch = useDispatch();
  const onClick = useCallback(() => {
    dispatch(actions.unpause());
  }, [dispatch]);
  return <Button icon="play" onClick={onClick} type="button" variant="secondary" aria-label="Unpause query" />;
}

import React, { useCallback } from 'react';
import { Button } from '@grafana/ui';
import { actions } from '../state/actions';

type Props = {
  rawQuery: string;
  dispatch: any;
};

export function PlayButton({ dispatch }: Props) {
  const onClick = useCallback(() => {
    dispatch(actions.unpause());
  }, [dispatch]);
  return <Button icon="play" onClick={onClick} type="button" variant="secondary" />;
}

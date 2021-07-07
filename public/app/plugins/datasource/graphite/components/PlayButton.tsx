import React, { useCallback } from 'react';
import { Button } from '@grafana/ui';
import { actions } from '../state/actions';

type Props = {
  rawQuery: string;
  dispatch: any;
};

export function PlayButton(props: Props) {
  const onClick = useCallback(() => {
    props.dispatch(actions.unpause());
  }, []);
  return <Button icon="play" onClick={onClick} type="button" variant="secondary" />;
}

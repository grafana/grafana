export type QueryCoauthoringSurfaceState = 'pending' | 'ready' | 'unavailable' | 'failed';

export interface QueryCoauthoringSurface {
  identity: string;
  generation: string;
  state: QueryCoauthoringSurfaceState;
}

export function transitionQueryCoauthoringSurface(
  current: QueryCoauthoringSurface,
  identity: string,
  event: { generation: string; state: Exclude<QueryCoauthoringSurfaceState, 'pending'> }
): QueryCoauthoringSurface {
  if (current.identity !== identity || current.generation !== event.generation) {
    return current;
  }

  if (current.state === 'pending' || (current.state === 'ready' && event.state !== 'ready')) {
    return { ...current, state: event.state };
  }

  return current;
}

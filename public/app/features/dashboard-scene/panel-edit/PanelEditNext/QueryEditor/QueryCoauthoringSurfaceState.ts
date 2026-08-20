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

  return { ...current, state: event.state };
}

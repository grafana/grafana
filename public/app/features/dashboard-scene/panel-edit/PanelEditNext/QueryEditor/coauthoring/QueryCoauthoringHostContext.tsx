import { createContext, type ReactNode, useContext } from 'react';

import { type DataQuery } from '@grafana/data';

export interface QueryCoauthoringHost {
  datasourceType: string;
  previewPhase: 'idle' | 'pending' | 'running' | 'complete';
  timeRange?: { from: number; to: number };
  preview(query: DataQuery): boolean;
  accept(query: DataQuery): boolean;
  revert(): void;
}

const QueryCoauthoringHostContext = createContext<QueryCoauthoringHost | undefined>(undefined);

export function QueryCoauthoringHostProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: QueryCoauthoringHost;
}) {
  return <QueryCoauthoringHostContext.Provider value={value}>{children}</QueryCoauthoringHostContext.Provider>;
}

export function useQueryCoauthoringHost(): QueryCoauthoringHost {
  const host = useContext(QueryCoauthoringHostContext);
  if (!host) {
    throw new Error('Query coauthoring must be rendered by a PanelEditNext host.');
  }
  return host;
}

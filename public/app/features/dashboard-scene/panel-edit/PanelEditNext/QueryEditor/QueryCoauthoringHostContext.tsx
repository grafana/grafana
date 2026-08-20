import { createContext, type ReactNode, useContext } from 'react';

import { type DataQuery } from '@grafana/data';

export interface QueryCoauthoringHost {
  queryKey: string;
  preview(query: DataQuery, baselineRevision?: string): void;
  accept(query: DataQuery, baselineRevision?: string): void;
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

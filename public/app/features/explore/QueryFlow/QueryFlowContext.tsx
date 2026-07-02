import { createContext, useContext } from 'react';

export interface QueryFlowContextValue {
  /** Whether the query flow feature is available in this pane. */
  enabled: boolean;
  /** Whether a given query's flow graph is open. */
  isOpen: (refId: string) => boolean;
  /** Open/close a given query's flow graph. */
  toggle: (refId: string) => void;
  /** Close a given query's flow graph. */
  close: (refId: string) => void;
}

const defaultValue: QueryFlowContextValue = {
  enabled: false,
  isOpen: () => false,
  toggle: () => {},
  close: () => {},
};

export const QueryFlowContext = createContext<QueryFlowContextValue>(defaultValue);

export function useQueryFlowContext(): QueryFlowContextValue {
  return useContext(QueryFlowContext);
}

import React, { createContext, useContext } from 'react';

export interface DashboardDndState {
  tabDrag?: {
    sourceDroppableId: string;
    destinationDroppableId?: string;
  };
}

const DashboardDndContext = createContext<DashboardDndState>({});

export function DashboardDndProvider({ value, children }: { value: DashboardDndState; children: React.ReactNode }) {
  return <DashboardDndContext.Provider value={value}>{children}</DashboardDndContext.Provider>;
}

export function useDashboardDndState(): DashboardDndState {
  return useContext(DashboardDndContext);
}

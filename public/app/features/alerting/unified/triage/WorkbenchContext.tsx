import React, { createContext, useContext } from 'react';

import { SceneQueryRunner } from '@grafana/scenes';

import { Domain } from './types';

interface WorkbenchContextValue {
  leftColumnWidth: number;
  domain: Domain;
  queryRunner: SceneQueryRunner;
}

const WorkbenchContext = createContext<WorkbenchContextValue | undefined>(undefined);

export function useWorkbenchContext(): WorkbenchContextValue {
  const context = useContext(WorkbenchContext);
  if (!context) {
    throw new Error('useWorkbenchContext must be used within a WorkbenchProvider');
  }
  return context;
}

interface WorkbenchProviderProps {
  leftColumnWidth: number;
  domain: Domain;
  queryRunner: SceneQueryRunner;
  children: React.ReactNode;
}

export function WorkbenchProvider({ leftColumnWidth, domain, queryRunner, children }: WorkbenchProviderProps) {
  return (
    <WorkbenchContext.Provider value={{ leftColumnWidth, domain, queryRunner }}>{children}</WorkbenchContext.Provider>
  );
}

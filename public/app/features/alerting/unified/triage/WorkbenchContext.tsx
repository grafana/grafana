import React, { createContext, useContext, useState } from 'react';

import { type SceneQueryRunner } from '@grafana/scenes';

import { type Domain } from './types';

interface WorkbenchContextValue {
  leftColumnWidth: number;
  rightColumnWidth: number;
  domain: Domain;
  queryRunner: SceneQueryRunner;
  /** Incrementing this signals all collapsible rows to expand. */
  expandGeneration: number;
  /** Incrementing this signals all collapsible rows to collapse. */
  collapseGeneration: number;
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
  rightColumnWidth: number;
  domain: Domain;
  queryRunner: SceneQueryRunner;
  expandGeneration: number;
  collapseGeneration: number;
  children: React.ReactNode;
}

export function WorkbenchProvider({
  leftColumnWidth,
  rightColumnWidth,
  domain,
  queryRunner,
  expandGeneration,
  collapseGeneration,
  children,
}: WorkbenchProviderProps) {
  return (
    <WorkbenchContext.Provider
      value={{ leftColumnWidth, rightColumnWidth, domain, queryRunner, expandGeneration, collapseGeneration }}
    >
      {children}
    </WorkbenchContext.Provider>
  );
}

/** Convenience hook — returns [expandAll, collapseAll] callbacks and the generation values to pass to WorkbenchProvider. */
export function useExpandCollapseAll() {
  const [expandGeneration, setExpandGeneration] = useState(0);
  const [collapseGeneration, setCollapseGeneration] = useState(0);

  const expandAll = () => setExpandGeneration((g) => g + 1);
  const collapseAll = () => setCollapseGeneration((g) => g + 1);

  return { expandGeneration, collapseGeneration, expandAll, collapseAll };
}

import { useEffect, useState } from 'react';

import { type ScopeNode } from '@grafana/data';

import { useScopeActions } from './useScopeActions';

// Light wrapper around the scopesSelectorService.getScopeNode to make it easier to use in the UI.
export function useScopeNode(scopeNodeId?: string) {
  const [node, setNode] = useState<ScopeNode | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const { isAvailable, getScopeNode } = useScopeActions();

  useEffect(() => {
    const loadNode = async () => {
      if (!scopeNodeId || !isAvailable) {
        setNode(undefined);
        return;
      }
      setIsLoading(true);
      try {
        const node = await getScopeNode(scopeNodeId);
        setNode(node);
      } catch (error) {
        console.error('Failed to load node', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadNode();
  }, [scopeNodeId, isAvailable, getScopeNode]);

  return { node, isLoading };
}

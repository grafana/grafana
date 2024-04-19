import { useCallback, useEffect, useState } from 'react';

import { DataQuerySpec, QueryTemplate, VariableDefinition } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import * as api from './api';

enum LoadingState {
  NEEDS_REFRESH,
  LOADED,
}

export const useQueryTemplates = () => {
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.NEEDS_REFRESH);
  const [queryTemplates, setQueryTemplates] = useState<QueryTemplate[]>([]);

  const reload = useCallback(async () => {
    async function getTemplates() {
      const templates = await api.getQueryTemplates();
      setQueryTemplates(templates);
    }
    return getTemplates();
  }, []);

  const deleteQueryTemplate = async (uid: string) => {
    await api.deleteQueryTemplate(uid);
    setLoadingState(LoadingState.NEEDS_REFRESH);
  };

  const createQueryTemplate = async (title: string, query: DataQuery, variableDefinitions: VariableDefinition[]) => {
    await api.createQueryTemplate({ title, query, variableDefinitions });
    setLoadingState(LoadingState.NEEDS_REFRESH);
  };

  const renderQueryTemplate = async (spec: DataQuerySpec, variables: Record<string, string>) => {
    return await api.renderQueryTemplate({ spec, variables });
  };

  useEffect(() => {
    if (loadingState === LoadingState.NEEDS_REFRESH) {
      reload().then(() => setLoadingState(LoadingState.LOADED));
    }
  }, [loadingState, reload]);

  return {
    queryTemplates,
    loadingState,
    deleteQueryTemplate,
    createQueryTemplate,
    renderQueryTemplate,
  };
};

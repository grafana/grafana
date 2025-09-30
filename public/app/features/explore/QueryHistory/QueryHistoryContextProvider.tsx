import { PropsWithChildren, useCallback, useMemo, useState } from 'react';

import { config } from '@grafana/runtime';

import { QueryHistoryContext, QueryHistoryDrawerOptions } from './QueryHistoryContext';
import { QueryHistoryDrawer } from './QueryHistoryDrawer';

export function QueryHistoryContextProvider({ children }: PropsWithChildren) {
  // Ensure drawer starts closed
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerOptions, setDrawerOptions] = useState<QueryHistoryDrawerOptions>({});
  const [context, setContext] = useState('unknown');


  const closeDrawer = useCallback(() => {
    console.log('QueryHistoryContextProvider: closeDrawer called');
    setIsDrawerOpen(false);
    setDrawerOptions({});
  }, []);

  const openDrawer = useCallback((options: QueryHistoryDrawerOptions) => {
    console.log('QueryHistoryContextProvider: openDrawer called', options);
    setDrawerOptions(options);
    setContext(options.options?.context?.toString() || 'unknown');
    setIsDrawerOpen(true);
  }, []);

  const contextVal = useMemo(
    () => ({
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      queryHistoryEnabled: Boolean(config.queryHistoryEnabled),
      context,
    }),
    [isDrawerOpen, openDrawer, closeDrawer, context]
  );

  console.log('QueryHistoryContextProvider render:', { isDrawerOpen, queryHistoryEnabled: Boolean(config.queryHistoryEnabled) });

  return (
    <QueryHistoryContext.Provider value={contextVal}>
      {children}
      <QueryHistoryDrawer
        isOpen={isDrawerOpen}
        close={closeDrawer}
        activeDatasources={drawerOptions.datasourceFilters || []}
        onSelectQuery={drawerOptions.onSelectQuery}
        options={drawerOptions.options}
      />
    </QueryHistoryContext.Provider>
  );
}

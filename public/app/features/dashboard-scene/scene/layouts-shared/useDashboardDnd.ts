import { createContext, useContext, useEffect, useState } from 'react';

type DashboardDnd = typeof import('@hello-pangea/dnd');

const DashboardDndContext = createContext<DashboardDnd | undefined>(undefined);

export const DashboardDndProvider = DashboardDndContext.Provider;

let dashboardDndPromise: Promise<DashboardDnd> | undefined;

function loadDashboardDnd() {
  dashboardDndPromise ??= import(/* webpackChunkName: "dashboard-drag-and-drop" */ '@hello-pangea/dnd');
  return dashboardDndPromise;
}

export function useDashboardDnd(enabled: boolean) {
  const [dashboardDnd, setDashboardDnd] = useState<DashboardDnd>();

  useEffect(() => {
    if (!enabled) {
      setDashboardDnd(undefined);
      return;
    }

    let cancelled = false;

    loadDashboardDnd().then((module) => {
      if (!cancelled) {
        setDashboardDnd(module);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return dashboardDnd;
}

export function useDashboardDndContext() {
  return useContext(DashboardDndContext);
}

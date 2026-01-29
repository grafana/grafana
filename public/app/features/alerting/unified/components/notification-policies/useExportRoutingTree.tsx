import { useCallback, useMemo, useState } from 'react';
import { useToggle } from 'react-use';

import { GrafanaPoliciesExporter } from '../export/GrafanaPoliciesExporter';

export const ALL_ROUTING_TREES = Symbol('all routing trees');

type ExportProps = [JSX.Element | null, (routeName: string | typeof ALL_ROUTING_TREES) => void];

export const useExportRoutingTree = (): ExportProps => {
  const [routeName, setRouteName] = useState<string | typeof ALL_ROUTING_TREES | null>(null);
  const [isExportDrawerOpen, toggleShowExportDrawer] = useToggle(false);

  const handleClose = useCallback(() => {
    setRouteName(null);
    toggleShowExportDrawer(false);
  }, [toggleShowExportDrawer]);

  const handleOpen = (routeName: string | typeof ALL_ROUTING_TREES) => {
    setRouteName(routeName);
    toggleShowExportDrawer(true);
  };

  const drawer = useMemo(() => {
    if (!routeName || !isExportDrawerOpen) {
      return null;
    }

    if (routeName === ALL_ROUTING_TREES) {
      // use this drawer when we want to export all policies
      return <GrafanaPoliciesExporter onClose={handleClose} />;
    } else {
      // use this one for exporting a single policy
      return <GrafanaPoliciesExporter routeName={routeName} onClose={handleClose} />;
    }
  }, [isExportDrawerOpen, handleClose, routeName]);

  return [drawer, handleOpen];
};

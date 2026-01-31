import { useCallback, useMemo, useState } from 'react';
import { useToggle } from 'react-use';

import { GrafanaPoliciesExporter } from '../export/GrafanaPoliciesExporter';

type ExportProps = [JSX.Element | null, (routeName: string) => void];

export const useExportRoutingTree = (): ExportProps => {
  const [routeName, setRouteName] = useState<string | null>(null);
  const [isExportDrawerOpen, toggleShowExportDrawer] = useToggle(false);

  const handleClose = useCallback(() => {
    setRouteName(null);
    toggleShowExportDrawer(false);
  }, [toggleShowExportDrawer]);

  const handleOpen = (routeName: string) => {
    setRouteName(routeName);
    toggleShowExportDrawer(true);
  };

  const drawer = useMemo(() => {
    if (!routeName || !isExportDrawerOpen) {
      return null;
    }

    return <GrafanaPoliciesExporter routeName={routeName} onClose={handleClose} />;
  }, [isExportDrawerOpen, handleClose, routeName]);

  return [drawer, handleOpen];
};

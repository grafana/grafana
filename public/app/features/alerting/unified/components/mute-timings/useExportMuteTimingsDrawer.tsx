import { useCallback, useMemo, useState } from 'react';
import { useToggle } from 'react-use';

import { GrafanaMuteTimingsExporter } from '../export/GrafanaMuteTimingsExporter';

export const ALL_MUTE_TIMINGS = Symbol('all mute timings');

type ExportProps = [JSX.Element | null, (muteTiming: string | typeof ALL_MUTE_TIMINGS) => void];

export const useExportMuteTimingsDrawer = (): ExportProps => {
  const [muteTimingName, setMuteTimingName] = useState<string | typeof ALL_MUTE_TIMINGS | null>(null);
  const [isExportDrawerOpen, toggleShowExportDrawer] = useToggle(false);

  const handleClose = useCallback(() => {
    setMuteTimingName(null);
    toggleShowExportDrawer(false);
  }, [toggleShowExportDrawer]);

  const handleOpen = (muteTimingName: string | typeof ALL_MUTE_TIMINGS) => {
    setMuteTimingName(muteTimingName);
    toggleShowExportDrawer(true);
  };

  const drawer = useMemo(() => {
    if (!muteTimingName || !isExportDrawerOpen) {
      return null;
    }

    if (muteTimingName === ALL_MUTE_TIMINGS) {
      // use this drawer when we want to export all mute timings
      return <GrafanaMuteTimingsExporter onClose={handleClose} />;
    } else {
      // use this one for exporting a single mute timing
      return <GrafanaMuteTimingsExporter muteTimingName={muteTimingName} onClose={handleClose} />;
    }
  }, [isExportDrawerOpen, handleClose, muteTimingName]);

  return [drawer, handleOpen];
};

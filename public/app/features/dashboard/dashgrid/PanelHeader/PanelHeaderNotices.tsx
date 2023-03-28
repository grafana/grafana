import React, { FC, useCallback } from 'react';

import { DataFrame, QueryResultMetaNotice } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { PanelHeaderNotice } from './PanelHeaderNotice';

interface Props {
  panelId: number;
  frames: DataFrame[];
}

export const PanelHeaderNotices: FC<Props> = ({ frames, panelId }) => {
  const openInspect = useCallback(
    (e: React.SyntheticEvent, tab: string) => {
      e.stopPropagation();
      locationService.partial({ inspect: panelId, inspectTab: tab });
    },
    [panelId]
  );

  // dedupe on severity
  const notices: Record<string, QueryResultMetaNotice> = {};
  for (const frame of frames) {
    if (!frame.meta || !frame.meta.notices) {
      continue;
    }

    for (const notice of frame.meta.notices) {
      notices[notice.severity] = notice;
    }
  }

  return (
    <>
      {Object.values(notices).map((notice) => (
        <PanelHeaderNotice notice={notice} onClick={openInspect} key={notice.severity} />
      ))}
    </>
  );
};

import React, { FC, useCallback } from 'react';
import { DataFrame, QueryResultMetaNotice } from '@grafana/data';
import { PanelHeaderNotice } from './PanelHeaderNotice';
import { useDispatch } from 'react-redux';
import { updateLocation } from '../../../../core/actions';

interface Props {
  panelId: number;
  frames: DataFrame[];
}

export const PanelHeaderNotices: FC<Props> = ({ frames, panelId }) => {
  const dispatch = useDispatch();
  const openInspect = useCallback(
    (e: React.SyntheticEvent, tab: string) => {
      e.stopPropagation();

      dispatch(
        updateLocation({
          query: { inspect: panelId, inspectTab: tab },
          partial: true,
        })
      );
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

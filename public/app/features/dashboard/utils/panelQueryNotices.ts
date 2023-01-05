import { DataFrame, QueryResultMetaNotice } from '@grafana/data';

interface Props {
  frames: DataFrame[];
}

export function getPanelQueryNotices({ frames }: Props): QueryResultMetaNotice[] {
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

  return Object.values(notices);
}

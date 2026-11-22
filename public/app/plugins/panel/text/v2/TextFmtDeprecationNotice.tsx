import { useMemo } from 'react';

import { type PanelNotice } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePanelNotices } from '@grafana/ui/unstable';

import { type RenderMode, type TextMode } from '../panelcfg.gen';

import { findFmtReads } from './fmtMigration';

const NOTICE_ID = 'text-v2-fmt-deprecated';

interface Props {
  content: string;
  mode: TextMode;
  renderMode?: RenderMode;
}

export function TextFmtDeprecationNotice({ content, mode, renderMode }: Props) {
  const items = useMemo<PanelNotice[]>(() => {
    const reads = findFmtReads(content, { mode, renderMode, hasFmtField: false });

    return reads.convertible + reads.unconverted.length > 0
      ? [
          {
            id: NOTICE_ID,
            severity: 'warning',
            text: t(
              'textng.fmt-notice.text',
              'This panel reads fmt, which is deprecated. Edit the panel to convert it to the display helper.'
            ),
            assistant: 'hidden',
          },
        ]
      : [];
  }, [content, mode, renderMode]);

  usePanelNotices(items);

  return null;
}

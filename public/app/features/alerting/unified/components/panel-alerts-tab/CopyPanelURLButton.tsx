import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import React, { FC } from 'react';
import { ClipboardButton } from '@grafana/ui';
import { AppEvents, urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import appEvents from 'app/core/app_events';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  className?: string;
}

export const CopyPanelURLButton: FC<Props> = ({ dashboard, panel, className }) => {
  if (!dashboard.meta.url || !panel.editSourceId) {
    return null;
  }

  const getText = () =>
    urlUtil.renderUrl(config.appUrl + dashboard.meta.url!.slice(1), {
      viewPanel: panel.editSourceId,
    });

  const onCopy = () => {
    appEvents.emit(AppEvents.alertSuccess, ['Content copied to clipboard']);
  };

  return (
    <ClipboardButton getText={getText} variant="secondary" icon="copy" onClipboardCopy={onCopy} className={className}>
      Copy panel URL to link to an existing rule
    </ClipboardButton>
  );
};

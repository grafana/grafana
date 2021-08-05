import React, { FC } from 'react';
import { DataLink, PanelData } from '@grafana/data';
import { Icon, PanelMenu } from '@grafana/ui';

import PanelHeaderCorner from './PanelHeaderCorner';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { getPanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';
import { PanelHeaderNotices } from './PanelHeaderNotices';
import { PanelHeaderLoadingIndicator } from './PanelHeaderLoadingIndicator';
import { usePanelMenuItems } from './PanelHeaderMenuProvider';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  title?: string;
  description?: string;
  links?: DataLink[];
  error?: string;
  alertState?: string;
  isViewing: boolean;
  isEditing: boolean;
  data: PanelData;
}

export const PanelHeader: FC<Props> = ({ panel, error, isViewing, isEditing, data, alertState, dashboard }) => {
  const onCancelQuery = () => panel.getQueryRunner().cancelQuery();
  const title = panel.getDisplayTitle();
  const items = usePanelMenuItems(panel, dashboard);
  const buttonClassName = isViewing || isEditing ? '' : 'grid-drag-handle';

  return (
    <PanelMenu
      title={title}
      items={items}
      buttonClassName={buttonClassName}
      outside={
        <>
          <PanelHeaderLoadingIndicator state={data.state} onClick={onCancelQuery} />
          <PanelHeaderCorner
            panel={panel}
            title={panel.title}
            description={panel.description}
            scopedVars={panel.scopedVars}
            links={getPanelLinksSupplier(panel)}
            error={error}
          />
        </>
      }
      inside={
        <>
          <PanelHeaderNotices frames={data.series} panelId={panel.id} />
          {panel.libraryPanel && <Icon name="library-panel" style={{ marginRight: '4px' }} />}
          {alertState ? (
            <Icon
              name={alertState === 'alerting' ? 'heart-break' : 'heart'}
              className="icon-gf panel-alert-icon"
              style={{ marginRight: '4px' }}
              size="sm"
            />
          ) : null}
          {data.request && data.request.timeInfo && (
            <span className="panel-time-info">
              <Icon name="clock-nine" size="sm" /> {data.request.timeInfo}
            </span>
          )}
        </>
      }
    />
  );
};

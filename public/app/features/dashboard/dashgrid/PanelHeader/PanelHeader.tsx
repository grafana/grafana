import React, { FC } from 'react';
import { cx } from 'emotion';
import { DataLink, PanelData } from '@grafana/data';
import { Icon } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import PanelHeaderCorner from './PanelHeaderCorner';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { getPanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';
import { PanelHeaderNotices } from './PanelHeaderNotices';
import { PanelHeaderMenuTrigger } from './PanelHeaderMenuTrigger';
import { PanelHeaderLoadingIndicator } from './PanelHeaderLoadingIndicator';
import { PanelHeaderMenuWrapper } from './PanelHeaderMenuWrapper';

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
  const title = panel.replaceVariables(panel.title, {}, 'text');
  const className = cx('panel-header', !(isViewing || isEditing) ? 'grid-drag-handle' : '');

  return (
    <>
      <PanelHeaderLoadingIndicator state={data.state} onClick={onCancelQuery} />
      <div className={className}>
        <PanelHeaderCorner
          panel={panel}
          title={panel.title}
          description={panel.description}
          scopedVars={panel.scopedVars}
          links={getPanelLinksSupplier(panel)}
          error={error}
        />
        <PanelHeaderMenuTrigger aria-label={selectors.components.Panels.Panel.title(title)}>
          {({ closeMenu, panelMenuOpen }) => {
            return (
              <div className="panel-title">
                <PanelHeaderNotices frames={data.series} panelId={panel.id} />
                {alertState ? (
                  <Icon
                    name={alertState === 'alerting' ? 'heart-break' : 'heart'}
                    className="icon-gf panel-alert-icon"
                    style={{ marginRight: '4px' }}
                    size="sm"
                  />
                ) : null}
                <span className="panel-title-text">{title}</span>
                <Icon name="angle-down" className="panel-menu-toggle" />
                <PanelHeaderMenuWrapper panel={panel} dashboard={dashboard} show={panelMenuOpen} onClose={closeMenu} />
                {data.request && data.request.timeInfo && (
                  <span className="panel-time-info">
                    <Icon name="clock-nine" size="sm" /> {data.request.timeInfo}
                  </span>
                )}
              </div>
            );
          }}
        </PanelHeaderMenuTrigger>
      </div>
    </>
  );
};

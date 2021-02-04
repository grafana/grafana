import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { DataLink, PanelData } from '@grafana/data';
import { Icon } from '@grafana/ui';

import PanelHeaderCorner from './PanelHeaderCorner';

import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { getPanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';
import { PanelHeaderNotices } from './PanelHeaderNotices';
import { PanelHeaderMenuTrigger } from './PanelHeaderMenuTrigger';
import { PanelHeaderLoadingIndicator } from './PanelHeaderLoadingIndicator';
import { PanelHeaderMenuWrapper } from './PanelHeaderMenuWrapper';
import { selectors } from '@grafana/e2e-selectors';

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
  renderCounter?: number;
}

export class PanelHeader extends PureComponent<Props> {
  onCancelQuery = () => {
    this.props.panel.getQueryRunner().cancelQuery();
  };

  render() {
    const { panel, error, isViewing, isEditing, data, alertState, dashboard } = this.props;
    const title = panel.replaceVariables(panel.title, {}, 'text');

    const panelHeaderClass = classNames({
      'panel-header': true,
      'grid-drag-handle': !(isViewing || isEditing),
    });

    return (
      <>
        <PanelHeaderLoadingIndicator state={data.state} onClick={this.onCancelQuery} />
        <div className={panelHeaderClass}>
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
                  <PanelHeaderMenuWrapper
                    panel={panel}
                    dashboard={dashboard}
                    show={panelMenuOpen}
                    onClose={closeMenu}
                  />
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
  }
}

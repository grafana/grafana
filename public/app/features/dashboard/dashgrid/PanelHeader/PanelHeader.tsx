import { css, cx } from '@emotion/css';
import React, { FC } from 'react';

import { DataLink, GrafanaTheme2, PanelData } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Icon, useStyles2, ClickOutsideWrapper } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { getPanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';

import PanelHeaderCorner from './PanelHeaderCorner';
import { PanelHeaderLoadingIndicator } from './PanelHeaderLoadingIndicator';
import { PanelHeaderMenuTrigger } from './PanelHeaderMenuTrigger';
import { PanelHeaderMenuWrapper } from './PanelHeaderMenuWrapper';
import { PanelHeaderNotices } from './PanelHeaderNotices';

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
  const className = cx('panel-header', !(isViewing || isEditing) ? 'grid-drag-handle' : '');
  const styles = useStyles2(panelStyles);

  return (
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
      <div className={className}>
        <PanelHeaderMenuTrigger data-testid={selectors.components.Panels.Panel.title(title)}>
          {({ closeMenu, panelMenuOpen }) => {
            return (
              <ClickOutsideWrapper onClick={closeMenu} parent={document}>
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
                  <h2 className={styles.titleText}>{title}</h2>
                  {!dashboard.meta.publicDashboardAccessToken && (
                    <div data-testid="panel-dropdown">
                      <Icon name="angle-down" className="panel-menu-toggle" />
                      {panelMenuOpen ? (
                        <PanelHeaderMenuWrapper panel={panel} dashboard={dashboard} onClose={closeMenu} />
                      ) : null}
                    </div>
                  )}
                  {data.request && data.request.timeInfo && (
                    <span className="panel-time-info">
                      <Icon name="clock-nine" size="sm" /> {data.request.timeInfo}
                    </span>
                  )}
                </div>
              </ClickOutsideWrapper>
            );
          }}
        </PanelHeaderMenuTrigger>
      </div>
    </>
  );
};

const panelStyles = (theme: GrafanaTheme2) => {
  return {
    titleText: css`
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      max-width: calc(100% - 38px);
      cursor: pointer;
      font-weight: ${theme.typography.fontWeightMedium};
      font-size: ${theme.typography.body.fontSize};
      margin: 0;

      &:hover {
        color: ${theme.colors.text.primary};
      }
      .panel-has-alert & {
        max-width: calc(100% - 54px);
      }
    `,
  };
};

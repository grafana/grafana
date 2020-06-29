// Libraries
import React, { useMemo } from 'react';
import _ from 'lodash';
import { LocationUpdate } from '@grafana/runtime';
import { Button, HorizontalGroup, IconButton, stylesFactory, useTheme } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { connect, MapDispatchToProps } from 'react-redux';
// Utils
import config from 'app/core/config';
import store from 'app/core/store';
// Store
import { updateLocation } from 'app/core/actions';
import { addPanel } from 'app/features/dashboard/state/reducers';
// Types
import { DashboardModel, PanelModel } from '../../state';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import { css, cx, keyframes } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import tinycolor from 'tinycolor2';

export type PanelPluginInfo = { id: any; defaults: { gridPos: { w: any; h: any }; title: any } };

export interface OwnProps {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export interface DispatchProps {
  addPanel: typeof addPanel;
  updateLocation: typeof updateLocation;
}

export type Props = OwnProps & DispatchProps;

const getCopiedPanelPlugins = () => {
  const panels = _.chain(config.panels)
    .filter({ hideFromList: false })
    .map(item => item)
    .value();
  const copiedPanels = [];

  const copiedPanelJson = store.get(LS_PANEL_COPY_KEY);
  if (copiedPanelJson) {
    const copiedPanel = JSON.parse(copiedPanelJson);
    const pluginInfo: any = _.find(panels, { id: copiedPanel.type });
    if (pluginInfo) {
      const pluginCopy = _.cloneDeep(pluginInfo);
      pluginCopy.name = copiedPanel.title;
      pluginCopy.sort = -1;
      pluginCopy.defaults = copiedPanel;
      copiedPanels.push(pluginCopy);
    }
  }

  return _.sortBy(copiedPanels, 'sort');
};

export const AddPanelWidgetUnconnected: React.FC<Props> = ({ panel, dashboard, updateLocation, addPanel }) => {
  const theme = useTheme();

  const onCancelAddPanel = (evt: any) => {
    evt.preventDefault();
    dashboard.removePanel(panel);
  };

  const onCreateNewPanel = () => {
    const { gridPos } = panel;

    const newPanel: any = {
      type: 'graph',
      title: 'Panel Title',
      gridPos: { x: gridPos.x, y: gridPos.y, w: gridPos.w, h: gridPos.h },
    };

    dashboard.addPanel(newPanel);
    dashboard.removePanel(panel);

    const location: LocationUpdate = {
      query: {
        editPanel: newPanel.id,
      },
      partial: true,
    };

    updateLocation(location);
  };

  const onPasteCopiedPanel = (panelPluginInfo: PanelPluginInfo) => {
    const { gridPos } = panel;

    const newPanel: any = {
      type: panelPluginInfo.id,
      title: 'Panel Title',
      gridPos: {
        x: gridPos.x,
        y: gridPos.y,
        w: panelPluginInfo.defaults.gridPos.w,
        h: panelPluginInfo.defaults.gridPos.h,
      },
    };

    // apply panel template / defaults
    if (panelPluginInfo.defaults) {
      _.defaults(newPanel, panelPluginInfo.defaults);
      newPanel.title = panelPluginInfo.defaults.title;
      store.delete(LS_PANEL_COPY_KEY);
    }

    dashboard.addPanel(newPanel);
    dashboard.removePanel(panel);
  };

  const onCreateNewRow = () => {
    const newRow: any = {
      type: 'row',
      title: 'Row title',
      gridPos: { x: 0, y: 0 },
    };

    dashboard.addPanel(newRow);
    dashboard.removePanel(panel);
  };

  const styles = getStyles(theme);
  return (
    <div className={cx('panel-container', styles.wrapper)}>
      <AddPanelWidgetHandle onCancel={onCancelAddPanel} />
      <div className={styles.actionsWrapper}>
        <AddPanelWidgetCreate onCreate={onCreateNewPanel} onPasteCopiedPanel={onPasteCopiedPanel} />
        <div>
          <HorizontalGroup justify="center">
            <Button onClick={onCreateNewRow} variant="secondary" size="sm">
              Convert to row
            </Button>
          </HorizontalGroup>
        </div>
      </div>
    </div>
  );
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = { addPanel, updateLocation };

export const AddPanelWidget = connect(null, mapDispatchToProps)(AddPanelWidgetUnconnected);

interface AddPanelWidgetHandleProps {
  onCancel: (e: React.MouseEvent<HTMLButtonElement>) => void;
}
const AddPanelWidgetHandle: React.FC<AddPanelWidgetHandleProps> = ({ onCancel }) => {
  const theme = useTheme();
  const styles = getAddPanelWigetHandleStyles(theme);
  return (
    <div className={cx(styles.handle, 'grid-drag-handle')}>
      <IconButton name="times" onClick={onCancel} surface="header" className="add-panel-widget__close" />
    </div>
  );
};

interface AddPanelWidgetCreateProps {
  onCreate: () => void;
  onPasteCopiedPanel: (panelPluginInfo: PanelPluginInfo) => void;
}

const AddPanelWidgetCreate: React.FC<AddPanelWidgetCreateProps> = ({ onCreate, onPasteCopiedPanel }) => {
  const copiedPanelPlugins = useMemo(() => getCopiedPanelPlugins(), []);
  const theme = useTheme();
  const styles = getAddPanelWidgetCreateStyles(theme);
  return (
    <div className={styles.wrapper}>
      <HorizontalGroup>
        <Button icon="plus" size="md" onClick={onCreate} aria-label={selectors.pages.AddDashboard.addNewPanel}>
          Add new panel
        </Button>
        {copiedPanelPlugins.length === 1 && (
          <Button variant="secondary" size="md" onClick={() => onPasteCopiedPanel(copiedPanelPlugins[0])}>
            Paste copied panel
          </Button>
        )}
      </HorizontalGroup>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const pulsate = keyframes`
    0% {box-shadow: 0 0 0 2px ${theme.colors.bodyBg}, 0 0 0px 4px ${theme.colors.formFocusOutline};}
    50% {box-shadow: 0 0 0 2px ${theme.colors.bodyBg}, 0 0 0px 4px ${tinycolor(theme.colors.formFocusOutline)
    .darken(20)
    .toHexString()};}
    100% {box-shadow: 0 0 0 2px ${theme.colors.bodyBg}, 0 0 0px 4px  ${theme.colors.formFocusOutline};}
  `;
  return {
    wrapper: css`
      overflow: hidden;
      outline: 2px dotted transparent;
      outline-offset: 2px;
      box-shadow: 0 0 0 2px black, 0 0 0px 4px #1f60c4;
      animation: ${pulsate} 2s ease infinite;
    `,
    actionsWrapper: css`
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      justify-content: center;
    `,
  };
});

const getAddPanelWigetHandleStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    handle: css`
      position: absolute;
      cursor: grab;
      top: 0;
      left: 0;
      height: 26px;
      padding: 0 ${theme.spacing.xs};
      width: 100%;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      transition: background-color 0.1s ease-in-out;
      &:hover {
        background: ${theme.colors.bg2};
      }
    `,
  };
});

const getAddPanelWidgetCreateStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: ${theme.spacing.lg};
      &:hover {
        background: ${theme.colors.bg2};
      }
    `,
    icon: css`
      color: ${theme.colors.textWeak};
    `,
  };
});

// Libraries
import React, { useMemo, useState } from 'react';
import _ from 'lodash';
import { LocationUpdate } from '@grafana/runtime';
import { Button, Icon, IconButton, styleMixins, stylesFactory, useStyles, useTheme } from '@grafana/ui';
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
import { LibraryPanelsView } from '../../../library-panels/components/LibraryPanelsView/LibraryPanelsView';
import { LibraryPanelCardProps } from '../../../library-panels/components/LibraryPanelCard/LibraryPanelCard';

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
    .map((item) => item)
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

export const AddPanelWidgetUnconnected: React.FC<Props> = ({ panel, dashboard, updateLocation }) => {
  const onCancelAddPanel = (evt: any) => {
    evt.preventDefault();
    dashboard.removePanel(panel);
  };

  const onCreateNewPanel = (libraryPanel = false) => {
    const { gridPos } = panel;

    const newPanel: Partial<PanelModel> = {
      type: 'graph',
      title: 'Panel Title',
      gridPos: { x: gridPos.x, y: gridPos.y, w: gridPos.w, h: gridPos.h },
    };

    if (libraryPanel) {
      newPanel.libraryPanel = {
        uid: undefined,
        name: 'Panel Title',
      };
    }

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

  const onAddLibraryPanel = (libraryPanel: LibraryPanelCardProps) => {
    const { gridPos } = panel;

    const newPanel: PanelModel = {
      ...libraryPanel.model,
      gridPos,
      libraryPanel: {
        name: libraryPanel.title,
        uid: libraryPanel.uid,
        lastEdited: libraryPanel.lastEdited,
        lastAuthor: libraryPanel.lastAuthor,
        avatarURL: libraryPanel.avatarUrl,
      },
    };

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

  const styles = useStyles(getStyles);
  const copiedPanelPlugins = useMemo(() => getCopiedPanelPlugins(), []);

  const [addPanelView, setAddPanelView] = useState(false);

  return (
    <div className={cx('panel-container', styles.wrapper)}>
      <AddPanelWidgetHandle onCancel={onCancelAddPanel} />
      {addPanelView ? (
        <LibraryPanelsView
          className={styles.libraryPanelsWrapper}
          onCreateNewPanel={() => onCreateNewPanel(true)}
          formatDate={(dateString: string) => dashboard.formatDate(dateString, 'L')}
        >
          {(panel) => (
            <Button className={styles.buttonMargin} variant="secondary" onClick={() => onAddLibraryPanel(panel)}>
              Add library panel
            </Button>
          )}
        </LibraryPanelsView>
      ) : (
        <div className={styles.actionsWrapper}>
          <div className={styles.actionsRow}>
            <div onClick={() => onCreateNewPanel()}>
              <Icon name="file-blank" size="xl" />
              Add an empty panel
            </div>
            <div onClick={onCreateNewRow}>
              <Icon name="wrap-text" size="xl" />
              Add a new row
            </div>
          </div>
          {(config.featureToggles.panelLibrary || copiedPanelPlugins.length === 1) && (
            <div className={styles.actionsRow}>
              {config.featureToggles.panelLibrary && (
                <div onClick={() => setAddPanelView(true)}>
                  <Icon name="book-open" size="xl" />
                  Add a panel from the panel library
                </div>
              )}
              {copiedPanelPlugins.length === 1 && (
                <div onClick={() => onPasteCopiedPanel(copiedPanelPlugins[0])}>
                  <Icon name="clipboard-alt" size="xl" />
                  Paste panel from clipboard
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = { addPanel, updateLocation };

export const AddPanelWidget = connect(undefined, mapDispatchToProps)(AddPanelWidgetUnconnected);

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
    actionsRow: css`
      display: flex;
      flex-direction: row;
      column-gap: ${theme.spacing.sm};
      height: 100%;

      > div {
        justify-self: center;
        cursor: pointer;
        background: ${theme.colors.bg2};
        border-radius: ${theme.border.radius.sm};
        color: ${theme.colors.text};
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;

        &:hover {
          background: ${styleMixins.hoverColor(theme.colors.bg2, theme)};
        }

        &:hover > #book-icon {
          background: linear-gradient(#f05a28 30%, #fbca0a 99%);
        }
      }
    `,
    actionsWrapper: css`
      display: flex;
      flex-direction: column;
      row-gap: ${theme.spacing.sm};
      height: 100%;
      margin-left: ${theme.spacing.md};
      margin-right: ${theme.spacing.lg};
      margin-top: ${theme.spacing.base * 5}px;
      margin-bottom: ${theme.spacing.base * 5}px;
    `,
    buttonMargin: css`
      margin-right: ${theme.spacing.sm};
    `,
    libraryPanelsWrapper: css`
      padding-left: ${theme.spacing.xl};
      padding-right: ${theme.spacing.lg};
      padding-top: ${theme.spacing.base * 5}px;
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
      height: ${theme.height.sm}px;
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

// const getAddPanelWidgetCreateStyles = stylesFactory((theme: GrafanaTheme) => {
//   return {
//     wrapper: css`
//       cursor: pointer;
//       display: flex;
//       flex-direction: column;
//       align-items: center;
//       margin-bottom: ${theme.spacing.lg};
//       &:hover {
//         background: ${theme.colors.bg2};
//       }
//     `,
//     icon: css`
//       color: ${theme.colors.textWeak};
//     `,
//   };
// });

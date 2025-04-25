import { css } from '@emotion/css';
import { memo, ReactNode } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useLocation } from 'react-router-dom-v5-compat';

import { textUtil } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { locationService } from '@grafana/runtime';
import {
  ButtonGroup,
  ModalsController,
  ToolbarButton,
  useForceUpdate,
  ToolbarButtonRow,
  ConfirmModal,
  Badge,
} from '@grafana/ui';
import { updateNavIndex } from 'app/core/actions';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import config from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
import { appEvents } from 'app/core/core';
import { useBusEvent } from 'app/core/hooks/useBusEvent';
import { t, Trans } from 'app/core/internationalization';
import { ID_PREFIX, setStarred } from 'app/core/reducers/navBarTree';
import { removeNavIndex } from 'app/core/reducers/navModel';
import AddPanelButton from 'app/features/dashboard/components/AddPanelButton/AddPanelButton';
import { SaveDashboardDrawer } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDrawer';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';
import { updateTimeZoneForSession } from 'app/features/profile/state/reducers';
import { KioskMode, StoreState } from 'app/types';
import { DashboardMetaChangedEvent, ShowModalReactEvent } from 'app/types/events';

import {
  DynamicDashNavButtonModel,
  dynamicDashNavActions,
  registerDynamicDashNavAction,
} from '../../../dashboard-scene/utils/registerDynamicDashNavAction';

import { DashNavButton } from './DashNavButton';
import { DashNavTimeControls } from './DashNavTimeControls';
import { ShareButton } from './ShareButton';

const mapDispatchToProps = {
  removeNavIndex,
  setStarred,
  updateTimeZoneForSession,
  updateNavIndex,
};

const mapStateToProps = (state: StoreState) => ({
  navIndex: state.navIndex,
});

const connector = connect(mapStateToProps, mapDispatchToProps);

const selectors = e2eSelectors.pages.Dashboard.DashNav;

export interface OwnProps {
  dashboard: DashboardModel;
  isFullscreen: boolean;
  kioskMode?: KioskMode | null;
  hideTimePicker: boolean;
  folderTitle?: string;
  title: string;
}

export function addCustomLeftAction(content: DynamicDashNavButtonModel) {
  registerDynamicDashNavAction('left', content);
}

export function addCustomRightAction(content: DynamicDashNavButtonModel) {
  registerDynamicDashNavAction('right', content);
}

type Props = OwnProps & ConnectedProps<typeof connector>;

export const DashNav = memo<Props>((props) => {
  // this ensures the component rerenders when the location changes
  useLocation();
  const forceUpdate = useForceUpdate();

  // We don't really care about the event payload here only that it triggeres a re-render of this component
  useBusEvent(props.dashboard.events, DashboardMetaChangedEvent);

  const originalUrl = props.dashboard.snapshot?.originalUrl ?? '';
  const gotoSnapshotOrigin = () => {
    window.location.href = textUtil.sanitizeUrl(props.dashboard.snapshot.originalUrl);
  };

  const notifyApp = useAppNotification();
  const onOpenSnapshotOriginal = () => {
    try {
      const sanitizedUrl = new URL(textUtil.sanitizeUrl(originalUrl), config.appUrl);
      const appUrl = new URL(config.appUrl);
      if (sanitizedUrl.host !== appUrl.host) {
        appEvents.publish(
          new ShowModalReactEvent({
            component: ConfirmModal,
            props: {
              title: 'Proceed to external site?',
              modalClass: modalStyles,
              body: (
                <>
                  <p>
                    {`This link connects to an external website at`} <code>{originalUrl}</code>
                  </p>
                  <p>{"Are you sure you'd like to proceed?"}</p>
                </>
              ),
              confirmVariant: 'primary',
              confirmText: 'Proceed',
              onConfirm: gotoSnapshotOrigin,
            },
          })
        );
      } else {
        gotoSnapshotOrigin();
      }
    } catch (err) {
      notifyApp.error('Invalid URL', err instanceof Error ? err.message : undefined);
    }
  };

  const onStarDashboard = () => {
    DashboardInteractions.toolbarFavoritesClick();
    const dashboardSrv = getDashboardSrv();
    const { dashboard, navIndex, removeNavIndex, setStarred, updateNavIndex } = props;

    dashboardSrv.starDashboard(dashboard.uid, Boolean(dashboard.meta.isStarred)).then((newState) => {
      setStarred({ id: dashboard.uid, title: dashboard.title, url: dashboard.meta.url ?? '', isStarred: newState });
      const starredNavItem = navIndex['starred'];
      if (newState) {
        starredNavItem.children?.push({
          id: ID_PREFIX + dashboard.uid,
          text: dashboard.title,
          url: dashboard.meta.url ?? '',
          parentItem: starredNavItem,
        });
      } else {
        removeNavIndex(ID_PREFIX + dashboard.uid);
        const indexToRemove = starredNavItem.children?.findIndex((element) => element.id === ID_PREFIX + dashboard.uid);
        if (indexToRemove) {
          starredNavItem.children?.splice(indexToRemove, 1);
        }
      }
      updateNavIndex(starredNavItem);
      dashboard.meta.isStarred = newState;
      forceUpdate();
    });
  };

  const onOpenSettings = () => {
    DashboardInteractions.toolbarSettingsClick();
    locationService.partial({ editview: 'settings' });
  };

  const onPlaylistPrev = () => {
    playlistSrv.prev();
  };

  const onPlaylistNext = () => {
    playlistSrv.next();
  };

  const onPlaylistStop = () => {
    playlistSrv.stop();
    forceUpdate();
  };

  const addCustomContent = (actions: DynamicDashNavButtonModel[], buttons: ReactNode[]) => {
    actions.map((action, index) => {
      const Component = action.component;
      const element = <Component {...props} key={`button-custom-${index}`} />;
      typeof action.index === 'number' ? buttons.splice(action.index, 0, element) : buttons.push(element);
    });
  };

  const isPlaylistRunning = () => {
    return playlistSrv.state.isPlaying;
  };

  const renderLeftActions = () => {
    const isDevEnv = config.buildInfo.env === 'development';

    const { dashboard, kioskMode } = props;
    const { canStar, isStarred } = dashboard.meta;
    const buttons: ReactNode[] = [];

    if (kioskMode || isPlaylistRunning()) {
      return [];
    }

    if (canStar) {
      let desc = isStarred
        ? t('dashboard.toolbar.unmark-favorite', 'Unmark as favorite')
        : t('dashboard.toolbar.mark-favorite', 'Mark as favorite');
      buttons.push(
        <DashNavButton
          tooltip={desc}
          icon={isStarred ? 'favorite' : 'star'}
          iconType={isStarred ? 'mono' : 'default'}
          iconSize="lg"
          onClick={onStarDashboard}
          key="button-star"
        />
      );
    }

    if (dashboard.meta.publicDashboardEnabled) {
      // TODO: This will be replaced with the new badge component. Color is required but gets override by css
      buttons.push(
        <Badge
          color="blue"
          text={t('dashboard.dash-nav.render-left-actions.text-public', 'Public')}
          key="public-dashboard-button-badge"
          className={publicBadgeStyle}
          data-testid={selectors.publicDashboardTag}
        />
      );
    }

    if (isDevEnv && config.featureToggles.dashboardScene) {
      buttons.push(
        <DashNavButton
          key="button-scenes"
          tooltip={t('dashboard.dash-nav.render-left-actions.tooltip-view-as-scene', 'View as Scene')}
          icon="apps"
          onClick={() => {
            locationService.partial({ scenes: true });
          }}
        />
      );
    }

    addCustomContent(dynamicDashNavActions.left, buttons);
    return buttons;
  };

  const renderPlaylistControls = () => {
    return (
      <ButtonGroup key="playlist-buttons">
        <ToolbarButton
          tooltip={t('dashboard.toolbar.playlist-previous', 'Go to previous dashboard')}
          icon="backward"
          onClick={onPlaylistPrev}
          narrow
        />
        <ToolbarButton onClick={onPlaylistStop}>
          <Trans i18nKey="dashboard.toolbar.playlist-stop">Stop playlist</Trans>
        </ToolbarButton>
        <ToolbarButton
          tooltip={t('dashboard.toolbar.playlist-next', 'Go to next dashboard')}
          icon="forward"
          onClick={onPlaylistNext}
          narrow
        />
      </ButtonGroup>
    );
  };

  const renderTimeControls = () => {
    const { dashboard, updateTimeZoneForSession, hideTimePicker } = props;

    if (hideTimePicker) {
      return null;
    }
    return (
      <DashNavTimeControls dashboard={dashboard} onChangeTimeZone={updateTimeZoneForSession} key="time-controls" />
    );
  };

  const renderRightActions = () => {
    const { dashboard, isFullscreen, hideTimePicker } = props;
    const { canSave, canEdit, showSettings, canShare } = dashboard.meta;
    const { snapshot } = dashboard;
    const snapshotUrl = snapshot && snapshot.originalUrl;
    const buttons: ReactNode[] = [];

    if (isPlaylistRunning()) {
      return [renderPlaylistControls(), renderTimeControls()];
    }

    if (snapshotUrl) {
      buttons.push(
        <ToolbarButton
          tooltip={t('dashboard.toolbar.open-original', 'Open original dashboard')}
          onClick={onOpenSnapshotOriginal}
          icon="link"
          key="button-snapshot"
        />
      );
    }

    if (canSave && !isFullscreen) {
      buttons.push(
        <ModalsController key="button-save">
          {({ showModal, hideModal }) => (
            <ToolbarButton
              tooltip={t('dashboard.toolbar.save', 'Save dashboard')}
              icon="save"
              onClick={() => {
                showModal(SaveDashboardDrawer, {
                  dashboard,
                  onDismiss: hideModal,
                });
              }}
            />
          )}
        </ModalsController>
      );
    }

    addCustomContent(dynamicDashNavActions.right, buttons);

    if (showSettings) {
      buttons.push(
        <ToolbarButton
          tooltip={t('dashboard.toolbar.settings', 'Dashboard settings')}
          icon="cog"
          onClick={onOpenSettings}
          key="button-settings"
        />
      );
    }

    if (canEdit && !isFullscreen) {
      buttons.push(
        <AddPanelButton
          onToolbarAddMenuOpen={DashboardInteractions.toolbarAddClick}
          dashboard={dashboard}
          key="panel-add-dropdown"
        />
      );
    }

    if (canShare) {
      buttons.push(<ShareButton key="button-share" dashboard={dashboard} />);
    }

    // if the timepicker is hidden, we don't need to add this separator
    if (!hideTimePicker) {
      buttons.push(<NavToolbarSeparator key="toolbar-separator" />);
    }

    buttons.push(renderTimeControls());

    return buttons;
  };

  return (
    <AppChromeUpdate
      actions={
        <>
          {renderLeftActions()}
          <NavToolbarSeparator leftActionsSeparator />
          <ToolbarButtonRow alignment="right">{renderRightActions()}</ToolbarButtonRow>
        </>
      }
    />
  );
});

DashNav.displayName = 'DashNav';

export default connector(DashNav);

const modalStyles = css({
  width: 'max-content',
  maxWidth: '80vw',
});

const publicBadgeStyle = css({
  color: 'grey',
  backgroundColor: 'transparent',
  border: '1px solid',
});

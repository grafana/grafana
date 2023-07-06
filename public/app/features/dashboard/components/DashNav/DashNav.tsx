import { css } from '@emotion/css';
import React, { FC, ReactNode } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { textUtil } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { locationService } from '@grafana/runtime';
import {
  ButtonGroup,
  ModalsController,
  ToolbarButton,
  useForceUpdate,
  Tag,
  ToolbarButtonRow,
  ConfirmModal,
} from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import config from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
import { appEvents } from 'app/core/core';
import { useBusEvent } from 'app/core/hooks/useBusEvent';
import { t, Trans } from 'app/core/internationalization';
import { setStarred } from 'app/core/reducers/navBarTree';
import AddPanelButton from 'app/features/dashboard/components/AddPanelButton/AddPanelButton';
import { SaveDashboardDrawer } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDrawer';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel } from 'app/features/dashboard/state';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';
import { updateTimeZoneForSession } from 'app/features/profile/state/reducers';
import { KioskMode } from 'app/types';
import { DashboardMetaChangedEvent, ShowModalReactEvent } from 'app/types/events';

import { DashNavButton } from './DashNavButton';
import { DashNavTimeControls } from './DashNavTimeControls';
import { ShareButton } from './ShareButton';

const mapDispatchToProps = {
  setStarred,
  updateTimeZoneForSession,
};

const connector = connect(null, mapDispatchToProps);

const selectors = e2eSelectors.pages.Dashboard.DashNav;

export interface OwnProps {
  dashboard: DashboardModel;
  isFullscreen: boolean;
  kioskMode?: KioskMode | null;
  hideTimePicker: boolean;
  folderTitle?: string;
  title: string;
  onAddPanel: () => void;
}

interface DashNavButtonModel {
  show: (props: Props) => boolean;
  component: FC<Partial<Props>>;
  index?: number | 'end';
}

const customLeftActions: DashNavButtonModel[] = [];
const customRightActions: DashNavButtonModel[] = [];

export function addCustomLeftAction(content: DashNavButtonModel) {
  customLeftActions.push(content);
}

export function addCustomRightAction(content: DashNavButtonModel) {
  customRightActions.push(content);
}

type Props = OwnProps & ConnectedProps<typeof connector>;

export const DashNav = React.memo<Props>((props) => {
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
    const dashboardSrv = getDashboardSrv();
    const { dashboard, setStarred } = props;

    dashboardSrv.starDashboard(dashboard.uid, Boolean(dashboard.meta.isStarred)).then((newState) => {
      setStarred({ id: dashboard.uid, title: dashboard.title, url: dashboard.meta.url ?? '', isStarred: newState });
      dashboard.meta.isStarred = newState;
      forceUpdate();
    });
  };

  const onOpenSettings = () => {
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

  const addCustomContent = (actions: DashNavButtonModel[], buttons: ReactNode[]) => {
    actions.map((action, index) => {
      const Component = action.component;
      const element = <Component {...props} key={`button-custom-${index}`} />;
      typeof action.index === 'number' ? buttons.splice(action.index, 0, element) : buttons.push(element);
    });
  };

  const isPlaylistRunning = () => {
    return playlistSrv.isPlaying;
  };

  const renderLeftActions = () => {
    const { dashboard, kioskMode } = props;
    const { canStar, canShare, isStarred } = dashboard.meta;
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

    if (canShare) {
      buttons.push(<ShareButton key="button-share" dashboard={dashboard} />);
    }

    if (dashboard.meta.publicDashboardEnabled) {
      buttons.push(
        <Tag key="public-dashboard" name="Public" colorIndex={5} data-testid={selectors.publicDashboardTag}></Tag>
      );
    }

    addCustomContent(customLeftActions, buttons);
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
    const { dashboard, onAddPanel, isFullscreen, kioskMode } = props;
    const { canSave, canEdit, showSettings } = dashboard.meta;
    const { snapshot } = dashboard;
    const snapshotUrl = snapshot && snapshot.originalUrl;
    const buttons: ReactNode[] = [];

    if (isPlaylistRunning()) {
      return [renderPlaylistControls(), renderTimeControls()];
    }

    if (kioskMode === KioskMode.TV) {
      return [renderTimeControls()];
    }

    if (canEdit && !isFullscreen) {
      if (config.featureToggles.emptyDashboardPage) {
        buttons.push(<AddPanelButton dashboard={dashboard} key="panel-add-dropdown" />);
      } else {
        buttons.push(
          <ToolbarButton
            tooltip={t('dashboard.toolbar.add-panel', 'Add panel')}
            icon="panel-add"
            iconSize="xl"
            onClick={onAddPanel}
            key="button-panel-add"
          />
        );
      }
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

    addCustomContent(customRightActions, buttons);

    buttons.push(renderTimeControls());

    if (config.featureToggles.scenes) {
      buttons.push(
        <ToolbarButton
          key="button-scenes"
          tooltip={'View as Scene'}
          icon="apps"
          onClick={() => locationService.push(`/scenes/dashboard/${dashboard.uid}`)}
        />
      );
    }
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

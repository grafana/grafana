import { css, cx, keyframes } from '@emotion/css';
import * as React from 'react';
import tinycolor from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';
import { LibraryPanel } from '@grafana/schema';
import { IconButton, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import {
  LibraryPanelsSearch,
  LibraryPanelsSearchVariant,
} from '../../../library-panels/components/LibraryPanelsSearch/LibraryPanelsSearch';
import { DashboardModel } from '../../state/DashboardModel';
import { PanelModel } from '../../state/PanelModel';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export const AddLibraryPanelWidget = ({ panel, dashboard }: Props) => {
  const onCancelAddPanel = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.preventDefault();
    dashboard.removePanel(panel);
  };

  const onAddLibraryPanel = (panelInfo: LibraryPanel) => {
    const { gridPos } = panel;

    const newPanel = {
      ...panelInfo.model,
      gridPos,
      libraryPanel: panelInfo,
    };

    dashboard.addPanel(newPanel);
    dashboard.removePanel(panel);
  };

  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <div className={styles.callToAction}>
        <div className={cx(styles.headerRow, 'grid-drag-handle')}>
          <span>
            <Trans i18nKey="library-panel.add-widget.title">Add panel from panel library</Trans>
          </span>
          <div className="flex-grow-1" />
          <IconButton
            aria-label={t(
              'dashboard.add-library-panel-widget.aria-label-close-add-panel-widget',
              "Close 'Add Panel' widget"
            )}
            name="times"
            onClick={onCancelAddPanel}
            tooltip={t('dashboard.add-library-panel-widget.tooltip-close-widget', 'Close widget')}
          />
        </div>
        <LibraryPanelsSearch onClick={onAddLibraryPanel} variant={LibraryPanelsSearchVariant.Tight} showPanelFilter />
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const pulsate = keyframes({
    '0%': {
      boxShadow: `0 0 0 2px ${theme.colors.background.canvas}, 0 0 0px 4px ${theme.colors.primary.main}`,
    },
    '50%': {
      boxShadow: `0 0 0 2px ${theme.components.dashboard.background}, 0 0 0px 4px ${tinycolor(theme.colors.primary.main)
        .darken(20)
        .toHexString()}`,
    },
    '100%': {
      boxShadow: `0 0 0 2px ${theme.components.dashboard.background}, 0 0 0px 4px  ${theme.colors.primary.main}`,
    },
  });

  return {
    // wrapper is used to make sure box-shadow animation isn't cut off in dashboard page
    wrapper: css({
      height: '100%',
      paddingTop: `${theme.spacing(0.5)}`,
    }),
    headerRow: css({
      display: 'flex',
      alignItems: 'center',
      height: '38px',
      flexShrink: 0,
      width: '100%',
      fontSize: theme.typography.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      paddingLeft: `${theme.spacing(1)}`,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'background-color 0.1s ease-in-out',
      },
      cursor: 'move',

      '&:hover': {
        background: `${theme.colors.background.secondary}`,
      },
    }),
    callToAction: css({
      backgroundColor: theme.components.panel.background,
      border: `1px solid ${theme.components.panel.borderColor}`,
      borderRadius: theme.shape.radius.default,
      display: 'flex',
      flex: '1 1 0',
      flexDirection: 'column',
      height: '100%',
      position: 'relative',
      width: '100%',
      outline: '2px dotted transparent',
      outlineOffset: '2px',
      overflow: 'hidden',

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${pulsate} 2s ease infinite`,
      },
    }),
  };
};

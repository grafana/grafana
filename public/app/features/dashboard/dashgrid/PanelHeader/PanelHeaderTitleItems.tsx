import { css, cx } from '@emotion/css';
import React from 'react';

import { PanelData, GrafanaTheme2, PanelModel, LinkModel, AlertState, DataLink } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { getFocusStyles, getMouseFocusStyles } from '@grafana/ui/src/themes/mixins';

import { PanelLinks } from '../PanelLinks';

import { PanelHeaderNotices } from './PanelHeaderNotices';

export interface Props {
  alertState?: string;
  data: PanelData;
  panelId: number;
  onShowPanelLinks?: () => Array<LinkModel<PanelModel>>;
  panelLinks?: DataLink[];
}

export function PanelHeaderTitleItems(props: Props) {
  const { alertState, data, panelId, onShowPanelLinks, panelLinks } = props;
  const styles = useStyles2(getStyles);

  // panel health
  const alertStateItem = (
    <Tooltip content={`alerting is ${alertState}`}>
      <span
        className={cx(styles.item, {
          [styles.ok]: alertState === AlertState.OK,
          [styles.pending]: alertState === AlertState.Pending,
          [styles.alerting]: alertState === AlertState.Alerting,
        })}
      >
        <Icon name={alertState === 'alerting' ? 'heart-break' : 'heart'} className="panel-alert-icon" />
      </span>
    </Tooltip>
  );

  const timeshift = (
    <>
      <Tooltip
        content={data.request?.range ? `Time Range: ${data.request.range.from} to ${data.request.range.to}` : ''}
      >
        <span className={cx(styles.item, styles.timeshift)}>
          <Icon name="clock-nine" />
          {data.request?.timeInfo}
        </span>
      </Tooltip>
    </>
  );

  return (
    <>
      {panelLinks && panelLinks.length > 0 && onShowPanelLinks && (
        <PanelLinks onShowPanelLinks={onShowPanelLinks} panelLinks={panelLinks} />
      )}

      {<PanelHeaderNotices panelId={panelId} frames={data.series} />}
      {data.request && data.request.timeInfo && timeshift}
      {alertState && alertStateItem}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    item: css({
      label: 'panel-header-item',
      backgroundColor: 'inherit',
      cursor: 'auto',
      border: 'none',
      borderRadius: `${theme.shape.borderRadius()}`,
      padding: `${theme.spacing(0, 1)}`,
      height: `${theme.spacing(theme.components.height.md)}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',

      '&:focus, &:focus-visible': {
        ...getFocusStyles(theme),
        zIndex: 1,
      },
      '&: focus:not(:focus-visible)': getMouseFocusStyles(theme),

      '&:hover ': {
        boxShadow: `${theme.shadows.z1}`,
        background: `${theme.colors.background.secondary}`,
      },
    }),
    ok: css({
      color: theme.colors.success.text,
    }),
    pending: css({
      color: theme.colors.warning.text,
    }),
    alerting: css({
      color: theme.colors.error.text,
    }),
    timeshift: css({
      color: theme.colors.text.link,

      '&:hover': {
        color: theme.colors.emphasize(theme.colors.text.link, 0.03),
      },
    }),
  };
};

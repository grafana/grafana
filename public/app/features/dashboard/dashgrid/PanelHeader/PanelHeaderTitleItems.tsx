import { css, cx } from '@emotion/css';
import React from 'react';

import { PanelData, GrafanaTheme2, PanelModel, LinkModel, AlertState, DataLink } from '@grafana/data';
import { Icon, PanelChrome, Tooltip, useStyles2 } from '@grafana/ui';

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
      <PanelChrome.TitleItem
        className={cx({
          [styles.ok]: alertState === AlertState.OK,
          [styles.pending]: alertState === AlertState.Pending,
          [styles.alerting]: alertState === AlertState.Alerting,
        })}
      >
        <Icon name={alertState === 'alerting' ? 'heart-break' : 'heart'} className="panel-alert-icon" />
      </PanelChrome.TitleItem>
    </Tooltip>
  );

  const timeshift = (
    <>
      <Tooltip
        content={data.request?.range ? `Time Range: ${data.request.range.from} to ${data.request.range.to}` : ''}
      >
        <PanelChrome.TitleItem className={styles.timeshift}>
          <Icon name="clock-nine" />
          {data.request?.timeInfo}
        </PanelChrome.TitleItem>
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

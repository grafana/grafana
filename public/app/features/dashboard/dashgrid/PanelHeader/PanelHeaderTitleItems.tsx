import { css, cx } from '@emotion/css';
import React from 'react';

import { PanelData, GrafanaTheme2, PanelModel, LinkModel, AlertState, DataLink } from '@grafana/data';
import { Icon, PanelChrome, Tooltip, useStyles2, TimePickerTooltip } from '@grafana/ui';

import { PanelLinks } from '../PanelLinks';

import { PanelHeaderNotices } from './PanelHeaderNotices';

export interface AngularNotice {
  show: boolean;
  isAngularPanel: boolean;
  isAngularDatasource: boolean;
}

export interface Props {
  alertState?: string;
  data: PanelData;
  panelId: number;
  onShowPanelLinks?: () => Array<LinkModel<PanelModel>>;
  panelLinks?: DataLink[];
  angularNotice?: AngularNotice;
}

export function PanelHeaderTitleItems(props: Props) {
  const { alertState, data, panelId, onShowPanelLinks, panelLinks, angularNotice } = props;
  const styles = useStyles2(getStyles);

  // panel health
  const alertStateItem = (
    <Tooltip content={alertState ?? 'unknown'}>
      <PanelChrome.TitleItem
        className={cx({
          [styles.ok]: alertState === AlertState.OK,
          [styles.pending]: alertState === AlertState.Pending,
          [styles.alerting]: alertState === AlertState.Alerting,
        })}
      >
        <Icon name={alertState === 'alerting' ? 'heart-break' : 'heart'} className="panel-alert-icon" size="md" />
      </PanelChrome.TitleItem>
    </Tooltip>
  );

  const timeshift = (
    <>
      {data.request && data.request.timeInfo && (
        <Tooltip content={<TimePickerTooltip timeRange={data.request?.range} timeZone={data.request?.timezone} />}>
          <PanelChrome.TitleItem className={styles.timeshift}>
            <Icon name="clock-nine" size="md" /> {data.request?.timeInfo}
          </PanelChrome.TitleItem>
        </Tooltip>
      )}
    </>
  );

  const message = `This ${pluginType(angularNotice)} requires Angular (deprecated).`;
  const angularNoticeTooltip = (
    <Tooltip content={message}>
      <PanelChrome.TitleItem className={styles.angularNotice} data-testid="angular-deprecation-icon">
        <Icon name="exclamation-triangle" size="md" />
      </PanelChrome.TitleItem>
    </Tooltip>
  );

  return (
    <>
      {panelLinks && panelLinks.length > 0 && onShowPanelLinks && (
        <PanelLinks onShowPanelLinks={onShowPanelLinks} panelLinks={panelLinks} />
      )}

      {<PanelHeaderNotices panelId={panelId} frames={data.series} />}
      {timeshift}
      {alertState && alertStateItem}
      {angularNotice?.show && angularNoticeTooltip}
    </>
  );
}

const pluginType = (angularNotice?: AngularNotice): string => {
  if (angularNotice?.isAngularPanel) {
    return 'panel';
  }
  if (angularNotice?.isAngularDatasource) {
    return 'data source';
  }
  return 'panel or data source';
};

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
      gap: theme.spacing(0.5),
      whiteSpace: 'nowrap',

      '&:hover': {
        color: theme.colors.emphasize(theme.colors.text.link, 0.03),
      },
    }),
    angularNotice: css({
      color: theme.colors.warning.text,
    }),
  };
};

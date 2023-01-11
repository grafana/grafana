import { css } from '@emotion/css';
import React from 'react';

import { PanelData, GrafanaTheme2 } from '@grafana/data';
import { Icon, ToolbarButton, useStyles2 } from '@grafana/ui';

import { PanelHeaderNotices } from './PanelHeaderNotices';

export interface Props {
  alertState?: string;
  data: PanelData;
  panelId: number;
}

export function PanelHeaderTitleItems(props: Props) {
  const { alertState, data, panelId } = props;
  const styles = useStyles2(getStyles);

  // panel health
  const alertStateItem = (
    <ToolbarButton
      icon={<Icon name={alertState === 'alerting' ? 'heart-break' : 'heart'} className="panel-alert-icon" />}
      tooltip={`alerting is ${alertState}`}
      className={styles.item}
    />
  );

  const timeshift = (
    <>
      <ToolbarButton
        tooltip={data.request?.range ? `Timeshift: ${data.request.range.from} to ${data.request.range.to}` : ''}
        className={styles.timeshift}
        icon="clock-nine"
      >
        {data.request?.timeInfo}
      </ToolbarButton>
    </>
  );

  return (
    <>
      {<PanelHeaderNotices panelId={panelId} frames={data.series} />}
      {data.request && data.request.timeInfo && timeshift}
      {alertState && alertStateItem}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  item: css({
    border: 'none',
  }),

  timeshift: css({
    border: 'none',
    color: theme.colors.text.link,

    '&:hover': {
      color: theme.colors.emphasize(theme.colors.text.link, 0.03),
    },
  }),
});

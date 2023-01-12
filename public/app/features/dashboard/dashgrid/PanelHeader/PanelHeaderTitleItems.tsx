import { css, cx } from '@emotion/css';
import React from 'react';

import { PanelData, GrafanaTheme2, PanelModel, LinkModel } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { getFocusStyles, getMouseFocusStyles } from '@grafana/ui/src/themes/mixins';

import { PanelLinks } from '../PanelLinks';

import { PanelHeaderNotices } from './PanelHeaderNotices';

export interface Props {
  alertState?: string;
  data: PanelData;
  panelId: number;
  panelLinks?: () => Array<LinkModel<PanelModel>>;
}

export function PanelHeaderTitleItems(props: Props) {
  const { alertState, data, panelId, panelLinks } = props;
  const styles = useStyles2(getStyles);

  // panel health
  const alertStateItem = (
    <Tooltip content={`alerting is ${alertState}`} tabIndex={0}>
      <span className={styles.item}>
        <Icon name={alertState === 'alerting' ? 'heart-break' : 'heart'} className="panel-alert-icon" />
      </span>
    </Tooltip>
  );

  const timeshift = (
    <>
      <Tooltip
        content={data.request?.range ? `Timeshift: ${data.request.range.from} to ${data.request.range.to}` : ''}
        tabIndex={0}
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
      {panelLinks && <PanelLinks links={panelLinks} />}
      {<PanelHeaderNotices panelId={panelId} frames={data.series} />}
      {data.request && data.request.timeInfo && timeshift}
      {alertState && alertStateItem}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  item: css({
    color: `${theme.colors.text.secondary}`,
    backgroundColor: `${theme.colors.background.primary}`,
    cursor: 'auto',
    border: 'none',
    padding: `${theme.spacing(0, 1)}`,
    height: ` ${theme.spacing(theme.components.height.md)}`,
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
      color: `${theme.colors.text.primary}`,
      background: `${theme.colors.background.secondary}`,
    },
  }),

  timeshift: css({
    color: theme.colors.text.link,

    '&:hover': {
      color: theme.colors.emphasize(theme.colors.text.link, 0.03),
    },
  }),
});

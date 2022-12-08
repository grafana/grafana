import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, QueryResultMetaNotice } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

interface Props {
  notice: QueryResultMetaNotice;
  onClick: (e: React.SyntheticEvent, tab: string) => void;
}

export function PanelHeaderNotice({ notice, onClick }: Props) {
  const styles = useStyles2(getStyles);

  const iconName =
    notice.severity === 'error' || notice.severity === 'warning' ? 'exclamation-triangle' : 'info-circle';

  return (
    <Tooltip content={notice.text} key={notice.severity}>
      {notice.inspect ? (
        <div className={styles.notice} onClick={(e) => onClick(e, notice.inspect!)}>
          <Icon name={iconName} />
        </div>
      ) : (
        <a className={styles.notice} href={notice.link} target="_blank" rel="noreferrer">
          <Icon name={iconName} />
        </a>
      )}
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const { headerHeight } = theme.components.panel;

  return {
    notice: css({
      label: 'panel-info-notice',
      width: theme.spacing(headerHeight),
      height: theme.spacing(headerHeight),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    }),
  };
};

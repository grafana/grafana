import { css } from '@emotion/css';
import React from 'react';

import { QueryResultMetaNotice } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { ToolbarButton } from '../ToolbarButton';

interface Props {
  notices: QueryResultMetaNotice[];
  onClick?: (e: React.SyntheticEvent, tab: string) => void;
}

export function PanelNotices({ notices, onClick }: Props) {
  const styles = useStyles2(getStyles);

  const renderNotice = (notice: QueryResultMetaNotice) => {
    const iconName =
      notice.severity === 'error' || notice.severity === 'warning' ? 'exclamation-triangle' : 'info-circle';

    if (notice.inspect && onClick) {
      return (
        <ToolbarButton
          className={styles.notice}
          icon={iconName}
          key={notice.severity}
          tooltip={notice.text}
          onClick={(e) => onClick(e, notice.inspect!)}
        />
      );
    }

    if (notice.link) {
      return (
        <a className={styles.notice} aria-label={notice.text} href={notice.link} target="_blank" rel="noreferrer">
          <Icon name={iconName} style={{ marginRight: '8px' }} />
        </a>
      );
    }

    return <ToolbarButton className={styles.notice} icon={iconName} key={notice.severity} tooltip={notice.text} />;
  };

  return <>{notices.map((notice) => renderNotice(notice))}</>;
}

const getStyles = () => ({
  notice: css({
    border: 'none',
  }),
});

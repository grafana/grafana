import { css } from '@emotion/css';
import React, { FC } from 'react';

import { QueryResultMetaNotice } from '@grafana/data';
import { Icon, ToolbarButton, useStyles2 } from '@grafana/ui';

interface Props {
  notice: QueryResultMetaNotice;
  onClick: (e: React.SyntheticEvent, tab: string) => void;
}

export const PanelHeaderNotice: FC<Props> = ({ notice, onClick }) => {
  const styles = useStyles2(getStyles);
  const iconName =
    notice.severity === 'error' || notice.severity === 'warning' ? 'exclamation-triangle' : 'info-circle';

  let noticeRender = notice.inspect && (
    <ToolbarButton
      className={styles.notice}
      icon={iconName}
      key={notice.severity}
      tooltip={notice.text}
      onClick={(e) => onClick(e, notice.inspect!)}
    />
  );

  if (notice.link) {
    noticeRender = (
      <a className={styles.notice} aria-label={notice.text} href={notice.link} target="_blank" rel="noreferrer">
        <Icon name={iconName} style={{ marginRight: '8px' }} />
      </a>
    );
  } else {
    noticeRender = (
      <ToolbarButton className={styles.notice} icon={iconName} key={notice.severity} tooltip={notice.text} />
    );
  }

  return <>{noticeRender}</>;
};

const getStyles = () => ({
  notice: css({
    border: 'none',
  }),
});

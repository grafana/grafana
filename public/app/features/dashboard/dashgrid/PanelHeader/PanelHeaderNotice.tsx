import React, { FC } from 'react';

import { QueryResultMetaNotice } from '@grafana/data';
import { Icon, Tooltip } from '@grafana/ui';

interface Props {
  notice: QueryResultMetaNotice;
  onClick: (e: React.SyntheticEvent, tab: string) => void;
}

export const PanelHeaderNotice: FC<Props> = ({ notice, onClick }) => {
  const iconName =
    notice.severity === 'error' || notice.severity === 'warning' ? 'exclamation-triangle' : 'info-circle';

  return (
    <Tooltip content={notice.text} key={notice.severity}>
      {notice.inspect ? (
        <div className="panel-info-notice pointer" onClick={(e) => onClick(e, notice.inspect!)}>
          <Icon name={iconName} style={{ marginRight: '8px' }} />
        </div>
      ) : (
        <a className="panel-info-notice" href={notice.link} target="_blank" rel="noreferrer">
          <Icon name={iconName} style={{ marginRight: '8px' }} />
        </a>
      )}
    </Tooltip>
  );
};

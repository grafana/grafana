import React, { useState } from 'react';

import { config } from '@grafana/runtime';
import { ToolbarButton } from '@grafana/ui';

import { DataTrail } from './DataTrail';
import { reportExploreMetrics } from './interactions';
import { getUrlForTrail } from './utils';

interface ShareTrailButtonState {
  trail: DataTrail;
}

export const ShareTrailButton = ({ trail }: ShareTrailButtonState) => {
  const [tooltip, setTooltip] = useState('Copy url');

  const onShare = () => {
    if (navigator.clipboard) {
      reportExploreMetrics('selected_metric_action_clicked', { action: 'share_url' });
      navigator.clipboard.writeText(config.appUrl + getUrlForTrail(trail));
      setTooltip('Copied!');
      setTimeout(() => {
        setTooltip('Copy url');
      }, 2000);
    }
  };

  return <ToolbarButton variant={'canvas'} icon={'share-alt'} tooltip={tooltip} onClick={onShare} />;
};

import React, { useState } from 'react';
import { useLocation } from 'react-use';

import { ToolbarButton } from '@grafana/ui';

interface ShareTrailButtonState {
  trailUrl: string;
}

export const ShareTrailButton = ({ trailUrl }: ShareTrailButtonState) => {
  const { origin } = useLocation();
  const [tooltip, setTooltip] = useState('Copy url');

  const onShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(origin + trailUrl);
      setTooltip('Copied!');
      setTimeout(() => {
        setTooltip('Copy url');
      }, 2000);
    }
  };

  return <ToolbarButton variant={'canvas'} icon={'share-alt'} tooltip={tooltip} onClick={onShare} />;
};

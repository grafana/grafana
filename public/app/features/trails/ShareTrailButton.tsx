import React, { useState } from 'react';
import { useLocation } from 'react-use';

import { ToolbarButton } from '@grafana/ui';

import { DataTrail } from './DataTrail';
import { getUrlForTrail } from './utils';

interface ShareTrailButtonState {
  trail: DataTrail;
}

export const ShareTrailButton = ({ trail }: ShareTrailButtonState) => {
  const { origin } = useLocation();
  const [tooltip, setTooltip] = useState('Copy url');

  const onShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(origin + getUrlForTrail(trail));
      setTooltip('Copied!');
      setTimeout(() => {
        setTooltip('Copy url');
      }, 2000);
    }
  };

  return <ToolbarButton variant={'canvas'} icon={'share-alt'} tooltip={tooltip} onClick={onShare} />;
};

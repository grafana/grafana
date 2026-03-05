import React from 'react';

import { t } from '@grafana/i18n';
import { IconButton } from '@grafana/ui';

interface Props {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  ref?: React.Ref<HTMLButtonElement> | null;
}
export function AnnotationTooltipHeaderCloseIcon({ onClick, ref }: Props) {
  return (
    <IconButton
      ref={ref}
      name={'times'}
      size={'sm'}
      onClick={onClick}
      tooltip={t('timeseries.annotation-editor2.tooltip-close', 'Close')}
    />
  );
}

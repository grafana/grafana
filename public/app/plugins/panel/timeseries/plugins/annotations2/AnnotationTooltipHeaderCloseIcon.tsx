import React from 'react';

import { t } from '@grafana/i18n';
import { IconButton } from '@grafana/ui';

interface Props {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  forwardRef?: React.Ref<HTMLButtonElement> | null;
}
export function AnnotationTooltipHeaderCloseIcon({ onClick, forwardRef }: Props) {
  return (
    <IconButton
      ref={forwardRef}
      name={'times'}
      size={'sm'}
      onClick={onClick}
      tooltip={t('timeseries.annotation-editor2.tooltip-close', 'Close')}
    />
  );
}

import { memo } from 'react';

import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';

import { useFeatureControlContext } from './FeatureControlProvider';

export const FeatureControlButton = memo(function FeatureControlButton() {
  const { isAccessible, isOpen, setIsOpen } = useFeatureControlContext();

  if (!isAccessible) {
    return null;
  }

  return (
    <ToolbarButton
      iconOnly
      icon="flask"
      aria-label={t('feature-control.button.aria-label', 'Feature control')}
      aria-expanded={isOpen}
      variant={isOpen ? 'active' : 'default'}
      tooltip={
        isOpen
          ? t('feature-control.button.close-tooltip', 'Close feature control')
          : t('feature-control.button.open-tooltip', 'Open feature control')
      }
      onClick={() => setIsOpen(!isOpen)}
    />
  );
});

import { memo } from 'react';

import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';

import { BubblingFlask } from './BubblingFlask';
import { useFeatureControlContext } from './FeatureControlProvider';
import { useFeatureFlagOverrides } from './useFeatureFlagOverrides';

// Rendered via LazyFeatureControlButton, which owns the `isAccessible` check.
export const FeatureControlButton = memo(function FeatureControlButton() {
  const { isOpen, setIsOpen } = useFeatureControlContext();
  const overrides = useFeatureFlagOverrides();

  return (
    <ToolbarButton
      iconOnly
      // 'lg' is the size ToolbarButton renders named icons at
      icon={<BubblingFlask bubbling={overrides.length > 0} size="lg" />}
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

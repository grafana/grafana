import { css } from '@emotion/css';
import { memo } from 'react';

import type { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ToolbarButton, useStyles2 } from '@grafana/ui';
import { getPreviewAssetsFolder } from 'app/core/utils/previewAssets';

import { useFeatureControlContext } from './FeatureControlProvider';

// Rendered via LazyFeatureControlButton, which owns the `isAccessible` check.
export const FeatureControlButton = memo(function FeatureControlButton() {
  const styles = useStyles2(getStyles);
  const { isOpen, setIsOpen, overrides } = useFeatureControlContext();
  const previewAssetsActive = Boolean(getPreviewAssetsFolder());
  const overridesActive = overrides.length > 0;
  const isActive = overridesActive || previewAssetsActive;

  return (
    <ToolbarButton
      iconOnly
      icon={isActive ? 'flask-bubbling' : 'flask'}
      className={isActive ? styles.active : undefined}
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

const getStyles = (theme: GrafanaTheme2) => ({
  active: css({
    '&, &:focus': {
      color: theme.colors.warning.text,
    },
  }),
});

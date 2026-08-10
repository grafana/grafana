import { css, cx } from '@emotion/css';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { GridLayoutType } from './utils';

export function LayoutModeIndicator({ layoutType, className }: { layoutType: GridLayoutType; className?: string }) {
  const styles = useStyles2(getStyles);
  const tooltip =
    layoutType === GridLayoutType.AutoGridLayout
      ? t('dashboard.auto-grid.layout-indicator', 'Auto layout – panel sizes are managed automatically')
      : t('dashboard.default-layout.layout-indicator', 'Custom layout');
  const icon: IconName = layoutType === GridLayoutType.AutoGridLayout ? 'apps' : 'window-grid';

  return (
    <Tooltip content={tooltip} placement="top">
      <Icon name={icon} size="sm" className={cx(className, styles.layoutIndicator)} />
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  layoutIndicator: css({
    cursor: 'help',
  }),
});

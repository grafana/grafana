import { type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Tooltip } from '@grafana/ui';

export function LayoutModeIndicator({ layoutMode: layoutType, className }: { layoutMode: 'auto' | 'custom'; className?: string }) {
  const tooltip =
    layoutType === 'auto'
      ? t('dashboard.auto-grid.layout-indicator', 'Auto layout - panel size managed by auto grid')
      : t('dashboard.default-layout.layout-indicator', 'Custom layout');
  const icon: IconName = layoutType === 'auto' ? 'apps' : 'window-grid';

  return (
    <Tooltip content={tooltip}>
      <Icon name={icon} size="sm" className={className} />
    </Tooltip>
  );
}

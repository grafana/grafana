import { t, Trans } from '@grafana/i18n';
import { Box, Icon, Tooltip } from '@grafana/ui';

export function MoveActionAvailableTargetWarning() {
  return (
    <Box>
      <Trans i18nKey="browse-dashboards.bulk-move-resources-form.move-warning">
        This will move selected folders and their descendants. Available target folders depend on the selected
        resources.
      </Trans>
      <Tooltip
        content={t(
          'browse-dashboards.bulk-move-resources-form.move-warning-tooltip',
          'You can only move provisioned resources within their provisioned folder, and local resources to local folders.'
        )}
      >
        <span style={{ marginLeft: '4px' }}>
          <Icon name="info-circle" size="sm" />
        </span>
      </Tooltip>
    </Box>
  );
}

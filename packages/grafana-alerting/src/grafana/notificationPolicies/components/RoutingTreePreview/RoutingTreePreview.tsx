import { Trans, t } from '@grafana/i18n';
import { Alert, Stack, Text } from '@grafana/ui';

import { type Label } from '../../../matchers/types';
import { useRoutingTreePreview } from '../../hooks/useRoutingTreePreview';

export interface RoutingTreePreviewProps {
  /** The tree to preview by name. Unset or a default name previews the default policy. A named tree that is
   * loading, deleted or failed to load renders nothing rather than falling back to the default. */
  routingTreeName?: string;
  /** Alert instance label sets to match against the tree's routes. */
  instances: Label[][];
}

/** Shows which receivers the given alert instances would notify under a routing tree. */
export function RoutingTreePreview({ routingTreeName, instances }: RoutingTreePreviewProps) {
  const matchedRoutes = useRoutingTreePreview(routingTreeName, instances);

  if (!matchedRoutes) {
    return null;
  }

  if (matchedRoutes.length === 0) {
    return (
      <Alert
        severity="info"
        title={t('alerting.routing-tree-preview.no-match', 'No matching notification policy found')}
      />
    );
  }

  return (
    <Stack direction="column" gap={1}>
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="alerting.routing-tree-preview.heading">Who would get notified</Trans>
      </Text>
      {matchedRoutes.map((route) => (
        <Text key={route.id}>
          {route.receiver || t('alerting.routing-tree-preview.default-receiver', 'Default receiver')}
        </Text>
      ))}
    </Stack>
  );
}

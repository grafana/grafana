import { t } from '@grafana/i18n';
import { Button, Card, Drawer, Icon, Stack, Text } from '@grafana/ui';

import { type HomeWidgetCatalogEntry } from './types';

interface AddWidgetDrawerProps {
  catalog: HomeWidgetCatalogEntry[];
  layoutIds: string[];
  onAdd: (entry: HomeWidgetCatalogEntry) => void;
  onClose: () => void;
}

/** Drawer listing catalog entries not yet on the grid, grouped by source. Adding keeps it open so several can be added. */
export function AddWidgetDrawer({ catalog, layoutIds, onAdd, onClose }: AddWidgetDrawerProps) {
  const available = catalog.filter((e) => !layoutIds.includes(e.id));

  // Curated + plugin entries share the "Plugins" group; only true built-ins are "Built-in".
  const groups = [
    {
      id: 'built-in',
      label: t('home.widgets.add.group.built-in', 'Built-in'),
      entries: available.filter((e) => e.source === 'core'),
    },
    {
      id: 'plugins',
      label: t('home.widgets.add.group.plugins', 'Plugins'),
      entries: available.filter((e) => e.source !== 'core'),
    },
  ];

  return (
    <Drawer
      title={t('home.widgets.add.title', 'Add a widget')}
      subtitle={t('home.widgets.add.subtitle', 'Pick widgets to add to your homepage')}
      onClose={onClose}
      size="md"
    >
      {available.length === 0 ? (
        <Text color="secondary">
          {t('home.widgets.add.empty', 'All available widgets are already on your homepage.')}
        </Text>
      ) : (
        <Stack direction="column" gap={2}>
          {groups
            .filter((group) => group.entries.length > 0)
            .map((group) => (
              <Stack key={group.id} direction="column" gap={1}>
                <Text element="h3" variant="h5">
                  {group.label}
                </Text>
                {group.entries.map((entry) => (
                  <Card key={entry.id} noMargin>
                    <Card.Figure>
                      <Icon name={entry.icon} size="xl" />
                    </Card.Figure>
                    <Card.Heading>{entry.title}</Card.Heading>
                    <Card.Description>{entry.description}</Card.Description>
                    <Card.Actions>
                      <Button variant="secondary" icon="plus" onClick={() => onAdd(entry)}>
                        {t('home.widgets.add.action', 'Add')}
                      </Button>
                    </Card.Actions>
                  </Card>
                ))}
              </Stack>
            ))}
        </Stack>
      )}
    </Drawer>
  );
}

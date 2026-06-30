import { t } from '@grafana/i18n';
import { Button, Card, Icon, Stack, Text } from '@grafana/ui';

import { HomeSection } from '../HomeSection';

import { getHomePresets } from './presets';
import { type HomeWidgetCatalogEntry } from './types';

interface PersonaPickerProps {
  catalog: HomeWidgetCatalogEntry[];
  onApply: (widgetIds: string[]) => void;
  onStartBlank: () => void;
}

/** First-run empty state: seed the grid from a preset/persona, or start with a blank grid. */
export function PersonaPicker({ catalog, onApply, onStartBlank }: PersonaPickerProps) {
  const presets = getHomePresets();

  return (
    <HomeSection>
      <Stack direction="column" gap={3}>
        <Stack direction="column" gap={1}>
          <Text element="h2" variant="h3">
            {t('home.presets.title', 'Get started')}
          </Text>
          <Text color="secondary">
            {t('home.presets.subtitle', 'Choose a starting point for your homepage. You can customize it later.')}
          </Text>
        </Stack>

        <Stack direction="row" gap={2} wrap="wrap">
          {presets.map((preset) => {
            const availableWidgetTitles = preset.widgetIds.flatMap((id) => {
              const entry = catalog.find((entry) => entry.id === id);
              return entry ? [entry.title] : [];
            });

            return (
              <Card key={preset.id} onClick={() => onApply(preset.widgetIds)} isCompact noMargin>
                <Card.Figure>
                  <Icon name={preset.icon} size="xxl" />
                </Card.Figure>
                <Card.Heading>{preset.title}</Card.Heading>
                <Card.Description>{preset.description}</Card.Description>
                {availableWidgetTitles.length > 0 && (
                  <Card.Meta>
                    {t('home.presets.included-widgets', 'Includes {{widgets}}', {
                      widgets: availableWidgetTitles.join(', '),
                    })}
                  </Card.Meta>
                )}
              </Card>
            );
          })}
        </Stack>

        <Button variant="secondary" fill="text" onClick={onStartBlank}>
          {t('home.presets.start-blank', 'Start blank')}
        </Button>
      </Stack>
    </HomeSection>
  );
}

import { DataTransformerID, standardTransformersRegistry, TransformerRegistryItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { Box, Button, Grid, Stack } from '@grafana/ui';

import { TransformationCard } from '../../../dashboard/components/TransformationsEditor/TransformationPickerNg';

interface EmptyTransformationsProps {
  onShowPicker: () => void;
  onGoToQueries?: () => void;
  onAddTransformation?: (transformationId: string) => void;
}

const TRANSFORMATION_IDS = [
  DataTransformerID.organize,
  DataTransformerID.groupBy,
  DataTransformerID.extractFields,
  DataTransformerID.filterByValue,
];

interface SQLTransformationTile {
  id: 'sql-transformation';
  name: string;
  description: string;
  isSQL: true;
}

export function EmptyTransformationsMessage(props: EmptyTransformationsProps) {
  const hasGoToQueries = props.onGoToQueries != null;
  const hasAddTransformation = props.onAddTransformation != null;

  // Get full registry items with images
  const transformations = standardTransformersRegistry.list().filter((t): t is TransformerRegistryItem => {
    return TRANSFORMATION_IDS.some((id) => t.id === id);
  });

  // Create SQL Transformation tile
  const sqlTransformationTile: SQLTransformationTile = {
    id: 'sql-transformation',
    name: 'SQL Transformation',
    description: t(
      'dashboard-scene.empty-transformations-message.sql-transformation-description',
      'Manipulate your data using MySQL-like syntax'
    ),
    isSQL: true,
  };

  // Combine SQL tile with other transformations, SQL tile first
  const allTiles = hasGoToQueries ? [sqlTransformationTile, ...transformations] : transformations;

  return (
    <Box alignItems="center" padding={4}>
      <Stack direction="column" alignItems="center" gap={4}>
        {(hasAddTransformation || hasGoToQueries) && (
          <Grid columns={5} gap={1}>
            {allTiles.map((tile) => {
              const isSQL = 'isSQL' in tile && tile.isSQL;

              return (
                <TransformationCard
                  key={tile.id}
                  transform={tile}
                  onClick={isSQL ? () => props.onGoToQueries?.() : (id) => props.onAddTransformation?.(id)}
                  showIllustrations={!isSQL}
                  showPluginState={false}
                  showTags={false}
                  testId={isSQL ? 'go-to-queries-button' : undefined}
                />
              );
            })}
          </Grid>
        )}
        <Stack direction="row" gap={2}>
          <Button
            icon="plus"
            variant="secondary"
            size="md"
            onClick={props.onShowPicker}
            data-testid={selectors.components.Transforms.addTransformationButton}
          >
            <Trans i18nKey="dashboard-scene.empty-transformations-message.see-more">See more</Trans>
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

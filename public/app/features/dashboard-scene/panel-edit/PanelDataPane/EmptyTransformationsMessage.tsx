import { DataTransformerID, standardTransformersRegistry, TransformerRegistryItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Box, Button, Grid, Stack, Text } from '@grafana/ui';
import config from 'app/core/config';

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
    name: 'SQL Expressions',
    description: t(
      'dashboard-scene.empty-transformations-message.sql-transformation-description',
      'Manipulate your data using MySQL-like syntax'
    ),
    isSQL: true,
  };

  // Combine SQL tile with other transformations, SQL tile first
  const allTiles = hasGoToQueries ? [sqlTransformationTile, ...transformations] : transformations;

  const handleSqlTransformationClick = () => {
    reportInteraction('grafana_panel_transformations_sql_transformation_clicked', {
      location: 'empty_transformations_placeholder',
    });
    props.onGoToQueries?.();
  };

  return (
    <>
      {config.featureToggles.transformationsEmptyPlaceholder ? (
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
                      onClick={isSQL ? handleSqlTransformationClick : (id) => props.onAddTransformation?.(id)}
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
      ) : (
        <Box alignItems="center" padding={4}>
          <Stack direction="column" alignItems="center" gap={2}>
            <Text element="h3" textAlignment="center">
              <Trans i18nKey="transformations.empty.add-transformation-header">Start transforming data</Trans>
            </Text>
            <Text
              element="p"
              textAlignment="center"
              data-testid={selectors.components.Transforms.noTransformationsMessage}
            >
              <Trans i18nKey="transformations.empty.add-transformation-body">
                Transformations allow data to be changed in various ways before your visualization is shown.
                <br />
                This includes joining data together, renaming fields, making calculations, formatting data for display,
                and more.
              </Trans>
            </Text>
            <Button
              icon="plus"
              variant="primary"
              size="md"
              onClick={props.onShowPicker}
              data-testid={selectors.components.Transforms.addTransformationButton}
            >
              <Trans i18nKey="dashboard-scene.empty-transformations-message.add-transformation">
                Add transformation
              </Trans>
            </Button>
          </Stack>
        </Box>
      )}
    </>
  );
}

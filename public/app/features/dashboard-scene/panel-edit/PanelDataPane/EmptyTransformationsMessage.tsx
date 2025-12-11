import { useMemo } from 'react';

import { DataTransformerID, standardTransformersRegistry, TransformerRegistryItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Box, Button, Grid, Stack, Text } from '@grafana/ui';
import config from 'app/core/config';

import { SqlExpressionCard } from '../../../dashboard/components/TransformationsEditor/SqlExpressionCard';
import { TransformationCard } from '../../../dashboard/components/TransformationsEditor/TransformationCard';
import sqlDarkImage from '../../../transformers/images/dark/sqlExpression.svg';
import sqlLightImage from '../../../transformers/images/light/sqlExpression.svg';

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

const GRID_COLUMNS_WITH_SQL = 5;
const GRID_COLUMNS_WITHOUT_SQL = 4;

export function LegacyEmptyTransformationsMessage({ onShowPicker }: { onShowPicker: () => void }) {
  return (
    <Box alignItems="center" padding={4}>
      <Stack direction="column" alignItems="center" gap={2}>
        <Text element="h3" textAlignment="center">
          <Trans i18nKey="transformations.empty.add-transformation-header">Start transforming data</Trans>
        </Text>
        <Text element="p" textAlignment="center" data-testid={selectors.components.Transforms.noTransformationsMessage}>
          <Trans i18nKey="transformations.empty.add-transformation-body">
            Transformations allow data to be changed in various ways before your visualization is shown.
            <br />
            This includes joining data together, renaming fields, making calculations, formatting data for display, and
            more.
          </Trans>
        </Text>
        <Button
          icon="plus"
          variant="primary"
          size="md"
          onClick={onShowPicker}
          data-testid={selectors.components.Transforms.addTransformationButton}
        >
          <Trans i18nKey="dashboard-scene.empty-transformations-message.add-transformation">Add transformation</Trans>
        </Button>
      </Stack>
    </Box>
  );
}

export function NewEmptyTransformationsMessage(props: EmptyTransformationsProps) {
  const hasGoToQueries = props.onGoToQueries != null;
  const hasAddTransformation = props.onAddTransformation != null;

  // Get transformations from registry
  const transformations = useMemo(() => {
    return standardTransformersRegistry.list().filter((t): t is TransformerRegistryItem => {
      return TRANSFORMATION_IDS.some((id) => t.id === id);
    });
  }, []);

  const handleSqlTransformationClick = () => {
    reportInteraction('dashboards_expression_interaction', {
      action: 'add_expression',
      expression_type: 'sql',
      context: 'empty_transformations_placeholder',
    });
    props.onGoToQueries?.();
  };

  const handleTransformationClick = (transformationId: string) => {
    reportInteraction('grafana_panel_transformations_clicked', {
      type: transformationId,
      context: 'empty_transformations_placeholder',
    });
    props.onAddTransformation?.(transformationId);
  };

  const handleShowMoreClick = () => {
    reportInteraction('grafana_panel_transformations_show_more_clicked', {
      context: 'empty_transformations_placeholder',
    });
    props.onShowPicker();
  };

  const showSqlCard = hasGoToQueries && config.featureToggles.sqlExpressions;
  const gridColumns = showSqlCard ? GRID_COLUMNS_WITH_SQL : GRID_COLUMNS_WITHOUT_SQL;

  return (
    <Box alignItems="center" padding={4}>
      <Stack direction="column" alignItems="center" gap={4}>
        {(hasAddTransformation || hasGoToQueries) && (
          <Grid columns={gridColumns} gap={1}>
            {showSqlCard && (
              <SqlExpressionCard
                name={t('dashboard-scene.empty-transformations-message.sql-name', 'Transform with SQL')}
                description={t(
                  'dashboard-scene.empty-transformations-message.sql-transformation-description',
                  'Manipulate your data using MySQL-like syntax'
                )}
                imageUrl={config.theme2.isDark ? sqlDarkImage : sqlLightImage}
                onClick={handleSqlTransformationClick}
                testId="go-to-queries-button"
              />
            )}
            {hasAddTransformation &&
              transformations.map((transform) => (
                <TransformationCard
                  key={transform.id}
                  transform={transform}
                  onClick={handleTransformationClick}
                  showIllustrations={true}
                  showPluginState={false}
                  showTags={false}
                />
              ))}
          </Grid>
        )}
        <Stack direction="row" gap={2}>
          <Button
            icon="plus"
            variant="primary"
            size="md"
            onClick={handleShowMoreClick}
            data-testid={selectors.components.Transforms.addTransformationButton}
          >
            <Trans i18nKey="dashboard-scene.empty-transformations-message.show-more">Show more</Trans>
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export function EmptyTransformationsMessage(props: EmptyTransformationsProps) {
  if (config.featureToggles.transformationsEmptyPlaceholder) {
    return <NewEmptyTransformationsMessage {...props} />;
  }

  return <LegacyEmptyTransformationsMessage onShowPicker={props.onShowPicker} />;
}

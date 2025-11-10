import { css } from '@emotion/css';

import { DataTransformerID, GrafanaTheme2, standardTransformersRegistry, TransformerRegistryItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { Box, Button, Card, Grid, Stack, useStyles2, useTheme2 } from '@grafana/ui';

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
  const theme = useTheme2();
  const styles = useStyles2(getTransformationGridStyles);

  // Get full registry items with images
  const transformations = standardTransformersRegistry.list().filter((t): t is TransformerRegistryItem => {
    return TRANSFORMATION_IDS.some((id) => t.id === id);
  });

  // Create SQL Transformation tile
  const sqlTransformationTile: SQLTransformationTile = {
    id: 'sql-transformation',
    name: 'SQL Transformation',
    description: 'Manipulate your data using MySQL-like syntax',
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
              // Check if it's the SQL transformation tile
              if ('isSQL' in tile && tile.isSQL) {
                return (
                  <Card
                    key={tile.id}
                    className={styles.newCard}
                    onClick={props.onGoToQueries}
                    noMargin
                    data-testid="go-to-queries-button"
                  >
                    <Card.Heading className={styles.heading}>
                      <div className={styles.titleRow}>
                        <span>{tile.name}</span>
                      </div>
                    </Card.Heading>
                    <Card.Description className={styles.description}>
                      <span>{tile.description}</span>
                    </Card.Description>
                  </Card>
                );
              }

              // Regular transformation tile
              if (!('isSQL' in tile)) {
                const transform = tile;
                const imageUrl = theme.isDark ? transform.imageDark : transform.imageLight;
                return (
                  <Card
                    key={transform.id}
                    className={styles.newCard}
                    onClick={() => props.onAddTransformation?.(transform.id)}
                    noMargin
                  >
                    <Card.Heading className={styles.heading}>
                      <div className={styles.titleRow}>
                        <span>{transform.name}</span>
                      </div>
                    </Card.Heading>
                    <Card.Description className={styles.description}>
                      <span>{transform.description}</span>
                      <span>
                        <img className={styles.image} src={imageUrl} alt={transform.name} />
                      </span>
                    </Card.Description>
                  </Card>
                );
              }
              return null;
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
            {/* <Trans i18nKey="dashboard-scene.empty-transformations-message.add-transformation">See more</Trans> */}
            See more
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

function getTransformationGridStyles(theme: GrafanaTheme2) {
  return {
    heading: css({
      fontWeight: 400,
      '> button': {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: theme.spacing(1),
      },
    }),
    titleRow: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'nowrap',
      width: '100%',
    }),
    description: css({
      fontSize: theme.typography.bodySmall.fontSize,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }),
    image: css({
      display: 'block',
      maxWidth: '100%',
      marginTop: theme.spacing(2),
    }),
    grid: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gridAutoRows: '1fr',
      gap: theme.spacing(1),
      width: '100%',
      padding: `${theme.spacing(1)} 0`,
    }),
    cardDisabled: css({
      backgroundColor: theme.colors.action.disabledBackground,
      img: {
        filter: 'grayscale(100%)',
        opacity: 0.33,
      },
    }),
    cardApplicableInfo: css({
      position: 'absolute',
      bottom: theme.spacing(1),
      right: theme.spacing(1),
    }),
    newCard: css({
      gridTemplateRows: 'min-content 0 1fr 0',
      marginBottom: 0,
    }),
    pluginStateInfoWrapper: css({
      marginLeft: theme.spacing(0.5),
    }),
    tagsWrapper: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
    }),
  };
}

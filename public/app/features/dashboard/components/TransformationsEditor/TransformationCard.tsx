import { cx, css } from '@emotion/css';

import {
  DataFrame,
  GrafanaTheme2,
  TransformerRegistryItem,
  TransformationApplicabilityLevels,
  standardTransformersRegistry,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Badge, Card, IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';

export interface TransformationCardProps {
  transform: TransformerRegistryItem;
  onClick: (id: string) => void;
  showIllustrations?: boolean;
  data?: DataFrame[];
  showPluginState?: boolean;
  showTags?: boolean;
}

export function TransformationCard({
  transform,
  showIllustrations,
  onClick,
  data = [],
  showPluginState = true,
  showTags = true,
}: TransformationCardProps) {
  const theme = useTheme2();
  const styles = useStyles2(getTransformationCardStyles);

  // Check to see if the transform is applicable to the given data
  let applicabilityScore = TransformationApplicabilityLevels.Applicable;
  if (data.length > 0 && transform.transformation.isApplicable !== undefined) {
    applicabilityScore = transform.transformation.isApplicable(data);
  }
  const isApplicable = applicabilityScore > 0;

  let applicabilityDescription = null;
  if (data.length > 0 && transform.transformation.isApplicableDescription !== undefined) {
    if (typeof transform.transformation.isApplicableDescription === 'function') {
      applicabilityDescription = transform.transformation.isApplicableDescription(data);
    } else {
      applicabilityDescription = transform.transformation.isApplicableDescription;
    }
  }

  const cardClasses = !isApplicable && data.length > 0 ? cx(styles.newCard, styles.cardDisabled) : styles.newCard;
  const imageUrl = theme.isDark ? transform.imageDark : transform.imageLight;
  const description = standardTransformersRegistry.getIfExists(transform.id)?.description;

  return (
    <Card
      className={cardClasses}
      data-testid={selectors.components.TransformTab.newTransform(transform.name)}
      onClick={() => onClick(transform.id)}
      noMargin
    >
      <Card.Heading className={styles.heading}>
        <div className={styles.titleRow}>
          <span>{transform.name}</span>
          {showPluginState && (
            <span className={styles.pluginStateInfoWrapper}>
              <PluginStateInfo state={transform.state} />
            </span>
          )}
        </div>
        {showTags && transform.tags && transform.tags.size > 0 && (
          <div className={styles.tagsWrapper}>
            {Array.from(transform.tags).map((tag) => (
              <Badge color="darkgrey" icon="tag-alt" key={tag} text={tag} />
            ))}
          </div>
        )}
      </Card.Heading>
      <Card.Description className={styles.description}>
        <span>{description}</span>
        {showIllustrations && imageUrl && (
          <span>
            <img className={styles.image} src={imageUrl} alt={transform.name} />
          </span>
        )}
        {!isApplicable && applicabilityDescription !== null && (
          <IconButton className={styles.cardApplicableInfo} name="info-circle" tooltip={applicabilityDescription} />
        )}
      </Card.Description>
    </Card>
  );
}

function getTransformationCardStyles(theme: GrafanaTheme2) {
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

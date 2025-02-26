import { Button, Icon, Text, Box, Card, Stack, useStyles2 } from '@grafana/ui';
import { FeatureInfo } from './types';
import { IconName } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

interface Props {
  feature: FeatureInfo;
  onSetup: () => void;
  showSetupButton?: boolean;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    card: css({
      maxWidth: '320px',
      width: '320px',
      height: '240px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }),
    cardContent: css({
      padding: theme.spacing(3),
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }),
    heading: css({
      marginBottom: theme.spacing(2),
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      width: '100%',
    }),
    headingContent: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    }),
    description: css({
      flex: 1,
      display: 'flex',
      marginBottom: theme.spacing(5),
      minHeight: '100px',
      maxHeight: '100px',
      overflow: 'hidden',
    }),
    iconContainer: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      marginRight: theme.spacing(2),
      width: '48px',
      height: '48px',
      flexShrink: 0,
    }),
    textContainer: css({
      flex: 1,
      display: 'flex',
      alignItems: 'flex-start',
      overflow: 'hidden',
    }),
    actions: css({
      display: 'flex',
      justifyContent: 'center',
      width: '100%',
      position: 'absolute',
      bottom: theme.spacing(3),
      left: 0,
      right: 0,
      zIndex: 1,
    }),
    statusIcon: css({
      marginLeft: theme.spacing(1),
      display: 'flex',
    }),
    configuredIcon: css({
      marginRight: theme.spacing(1),
    }),
    titleWrapper: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '85%',
      textAlign: 'center',
      whiteSpace: 'normal',
      display: 'flex',
      justifyContent: 'center',
    }),
    descriptionWrapper: css({
      display: '-webkit-box',
      WebkitLineClamp: 4,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    setupButton: css({
      marginTop: 'auto',
      width: 'auto',
      minWidth: '120px',
      maxWidth: '200px',
    }),
  };
};

export const FeatureCard = ({ feature, onSetup, showSetupButton = true }: Props) => {
  const styles = useStyles2(getStyles);
  const isConfigured = feature.steps.length === 0 || feature.steps.every((step) => step.fulfilled);
  const iconName = (feature.icon || 'apps') as IconName;

  return (
    <Card className={styles.card}>
      <div className={styles.cardContent}>
        <Card.Heading className={styles.heading}>
          <div className={styles.headingContent}>
            <div className={styles.titleWrapper}>
              <Text variant="h4">{feature.title}</Text>
            </div>
            <div className={styles.statusIcon}>
              {isConfigured ? (
                <Icon name="check-circle" color="green" />
              ) : (
                <Icon name="exclamation-triangle" color="orange" />
              )}
            </div>
          </div>
        </Card.Heading>

        <Card.Description className={styles.description}>
          <div className={styles.iconContainer}>
            <Icon name={iconName} size="xxl" />
          </div>
          <div className={styles.textContainer}>
            <div className={styles.descriptionWrapper}>
              <Text>{feature.description}</Text>
            </div>
          </div>
        </Card.Description>
      </div>

      {showSetupButton && (
        <div className={styles.actions}>
          <Button className={styles.setupButton} variant="primary" onClick={onSetup} icon="cog" size="md">
            Setup Now
          </Button>
        </div>
      )}
    </Card>
  );
};

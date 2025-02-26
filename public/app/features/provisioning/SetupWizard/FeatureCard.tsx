import { Button, useStyles2, Icon } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { FeatureInfo } from './types';

interface Props {
  feature: FeatureInfo;
  onSetup: () => void;
  isConfigured?: boolean;
  showSetupButton?: boolean;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    featureItem: css({
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.borderRadius(1),
      padding: theme.spacing(2),
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    featureHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing(1),
    }),
    featureTitle: css({
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      margin: 0,
    }),
    featureDescription: css({
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(2),
      flex: 1,
    }),
    featureButton: css({
      alignSelf: 'flex-start',
    }),
    configuredStatus: css({
      display: 'flex',
      alignItems: 'center',
      color: theme.colors.success.text,
      fontSize: theme.typography.body.fontSize,
      marginTop: 'auto',
    }),
    configuredIcon: css({
      color: theme.colors.success.main,
      marginRight: theme.spacing(1),
    }),
  };
};

export const FeatureCard = ({ feature, onSetup, isConfigured = false, showSetupButton = true }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.featureItem}>
      <div className={styles.featureHeader}>
        <h4 className={styles.featureTitle}>{feature.title}</h4>
      </div>
      <p className={styles.featureDescription}>{feature.description}</p>
      {showSetupButton && !isConfigured && (
        <Button variant="primary" onClick={onSetup} className={styles.featureButton}>
          Setup Now
        </Button>
      )}
      {isConfigured && (
        <div className={styles.configuredStatus}>
          <Icon name="check-circle" className={styles.configuredIcon} /> Configured
        </div>
      )}
    </div>
  );
};

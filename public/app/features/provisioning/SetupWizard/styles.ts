import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

// Define a type for our styles to ensure all properties are recognized
export interface SetupStyles {
  container: string;
  header: string;
  title: string;
  subtitle: string;
  content: string;
  footer: string;
  button: string;
  buttonSecondary: string;
  buttonDisabled: string;
  stepIndicator: string;
  stepIndicatorActive: string;
  stepIndicatorCompleted: string;
  stepTitle: string;
  stepTitleActive: string;
  stepTitleCompleted: string;
  stepContent: string;
  codeBlock: string;
  copyButton: string;
  copyIcon: string;
  checkIcon: string;
  featuresList: string;
  featureItem: string;
  featureTitle: string;
  featureDescription: string;
  featureButton: string;
  featureButtonDisabled: string;
  featureButtonSecondary: string;
  featureButtonPrimary: string;
  featureButtonText: string;
  featureButtonIcon: string;
  featureButtonIconDisabled: string;
  featureButtonIconSecondary: string;
  featureButtonIconPrimary: string;
  featureButtonIconText: string;
  featureButtonIconTextDisabled: string;
  featureButtonIconTextSecondary: string;
  featureButtonIconTextPrimary: string;
  fulfilledBadge: string;
  fulfilledStepContent: string;
  fulfilledIcon: string;
  featureHeader: string;
  completedBadge: string;
  stepDescription: string;
  instructionsContainer: string;
  instructionsTitle: string;
  instructionsSteps: string;
  instructionsFooter: string;
  configuredStatus: string;
  configuredIcon: string;
}

// Define a type for our compact styles
export interface CompactStyles {
  featuresList: string;
  featureItem: string;
  featureContent: string;
  bulletPoint: string;
  titleWithInfo: string;
  infoButton: string;
}

export const getStyles = (theme: GrafanaTheme2): SetupStyles => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }),
    header: css`
      padding: ${theme.spacing(2)};
      border-bottom: 1px solid ${theme.colors.border.weak};
    `,
    title: css({
      fontSize: theme.typography.h4.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      marginBottom: theme.spacing(1),
    }),
    subtitle: css({
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(2),
    }),
    content: css({
      flex: 1,
      overflowY: 'auto',
      padding: theme.spacing(2),
    }),
    footer: css({
      display: 'flex',
      justifyContent: 'flex-end',
      padding: theme.spacing(2),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      marginTop: theme.spacing(2),
    }),
    button: css`
      margin-left: ${theme.spacing(1)};
    `,
    buttonSecondary: css`
      margin-right: ${theme.spacing(1)};
    `,
    buttonDisabled: css`
      opacity: 0.5;
      cursor: not-allowed;
    `,
    stepIndicator: css`
      display: flex;
      align-items: center;
      margin-bottom: ${theme.spacing(2)};
    `,
    stepIndicatorActive: css`
      color: ${theme.colors.primary.text};
      font-weight: ${theme.typography.fontWeightBold};
    `,
    stepIndicatorCompleted: css`
      color: ${theme.colors.success.text};
    `,
    stepTitle: css({
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      marginBottom: theme.spacing(1),
    }),
    stepTitleActive: css`
      color: ${theme.colors.primary.text};
    `,
    stepTitleCompleted: css`
      color: ${theme.colors.success.text};
    `,
    stepContent: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    codeBlock: css({
      backgroundColor: theme.colors.background.canvas,
      borderRadius: theme.shape.borderRadius(1),
      padding: theme.spacing(2),
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      overflowX: 'auto',
      marginBottom: theme.spacing(2),
    }),
    copyButton: css({
      marginLeft: theme.spacing(1),
    }),
    copyIcon: css`
      margin-right: ${theme.spacing(0.5)};
    `,
    checkIcon: css({
      marginRight: theme.spacing(0.5),
    }),
    featuresList: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(3),
    }),
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
    completedBadge: css({
      backgroundColor: theme.colors.success.main,
      color: theme.colors.success.contrastText,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
      borderRadius: theme.shape.borderRadius(0.5),
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    fulfilledBadge: css({
      backgroundColor: theme.colors.success.main,
      color: theme.colors.success.contrastText,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
      borderRadius: theme.shape.borderRadius(0.5),
      marginLeft: theme.spacing(1),
      display: 'inline-block',
    }),
    stepDescription: css({
      marginBottom: theme.spacing(2),
    }),
    instructionsContainer: css({
      padding: theme.spacing(2),
    }),
    instructionsTitle: css({
      fontSize: theme.typography.h4.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      marginBottom: theme.spacing(2),
    }),
    instructionsSteps: css({
      marginBottom: theme.spacing(3),
    }),
    instructionsFooter: css({
      display: 'flex',
      justifyContent: 'flex-end',
      gap: theme.spacing(1),
    }),
    configuredStatus: css({
      display: 'flex',
      alignItems: 'center',
      color: theme.colors.success.text,
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.body.fontSize,
      marginTop: 'auto',
    }),
    configuredIcon: css({
      color: theme.colors.success.main,
      marginRight: theme.spacing(1),
    }),
  };
};

export const getCompactStyles = (theme: GrafanaTheme2): CompactStyles => {
  return {
    featuresList: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(1)};
    `,
    featureItem: css`
      display: flex;
      align-items: flex-start;
      padding: ${theme.spacing(1)};
    `,
    featureContent: css`
      margin-left: ${theme.spacing(1)};
    `,
    bulletPoint: css`
      color: ${theme.colors.primary.text};
      margin-right: ${theme.spacing(1)};
    `,
    titleWithInfo: css`
      display: flex;
      align-items: center;
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    infoButton: css`
      background: transparent;
      border: none;
      color: ${theme.colors.text.secondary};
      cursor: pointer;
      padding: 0;
      margin-left: ${theme.spacing(0.5)};
      &:hover {
        color: ${theme.colors.text.primary};
      }
    `,
  };
};

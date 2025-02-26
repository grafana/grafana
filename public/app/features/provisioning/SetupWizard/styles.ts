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
    container: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    `,
    header: css`
      padding: ${theme.spacing(2)};
      border-bottom: 1px solid ${theme.colors.border.weak};
    `,
    title: css`
      font-size: ${theme.typography.h4.fontSize};
      font-weight: ${theme.typography.h4.fontWeight};
      margin-bottom: ${theme.spacing(1)};
    `,
    subtitle: css`
      font-size: ${theme.typography.body.fontSize};
      color: ${theme.colors.text.secondary};
    `,
    content: css`
      flex: 1;
      padding: ${theme.spacing(2)};
      overflow-y: auto;
    `,
    footer: css`
      display: flex;
      justify-content: space-between;
      padding: ${theme.spacing(2)};
      border-top: 1px solid ${theme.colors.border.weak};
    `,
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
    stepTitle: css`
      font-size: ${theme.typography.h5.fontSize};
      font-weight: ${theme.typography.h5.fontWeight};
      margin-bottom: ${theme.spacing(1)};
    `,
    stepTitleActive: css`
      color: ${theme.colors.primary.text};
    `,
    stepTitleCompleted: css`
      color: ${theme.colors.success.text};
    `,
    stepContent: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    codeBlock: css`
      background-color: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius()};
      padding: ${theme.spacing(1)};
      margin-bottom: ${theme.spacing(2)};
      position: relative;
      font-family: monospace;
      white-space: pre-wrap;
      word-break: break-all;
    `,
    copyButton: css`
      position: absolute;
      top: ${theme.spacing(1)};
      right: ${theme.spacing(1)};
      background: transparent;
      border: none;
      color: ${theme.colors.text.secondary};
      cursor: pointer;
      &:hover {
        color: ${theme.colors.text.primary};
      }
    `,
    copyIcon: css`
      margin-right: ${theme.spacing(0.5)};
    `,
    checkIcon: css`
      margin-right: ${theme.spacing(0.5)};
      color: ${theme.colors.success.text};
    `,
    featuresList: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(2)};
    `,
    featureItem: css`
      display: flex;
      flex-direction: column;
      padding: ${theme.spacing(2)};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.borderRadius()};
      background-color: ${theme.colors.background.secondary};
    `,
    featureTitle: css`
      font-size: ${theme.typography.h6.fontSize};
      font-weight: ${theme.typography.h6.fontWeight};
      margin-bottom: ${theme.spacing(1)};
    `,
    featureDescription: css`
      font-size: ${theme.typography.body.fontSize};
      color: ${theme.colors.text.secondary};
      margin-bottom: ${theme.spacing(2)};
    `,
    featureButton: css`
      align-self: flex-start;
    `,
    featureButtonDisabled: css`
      opacity: 0.5;
      cursor: not-allowed;
    `,
    featureButtonSecondary: css`
      background-color: ${theme.colors.secondary.main};
      color: ${theme.colors.secondary.contrastText};
    `,
    featureButtonPrimary: css`
      background-color: ${theme.colors.primary.main};
      color: ${theme.colors.primary.contrastText};
    `,
    featureButtonText: css`
      font-size: ${theme.typography.body.fontSize};
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    featureButtonIcon: css`
      margin-right: ${theme.spacing(0.5)};
    `,
    featureButtonIconDisabled: css`
      opacity: 0.5;
    `,
    featureButtonIconSecondary: css`
      color: ${theme.colors.secondary.contrastText};
    `,
    featureButtonIconPrimary: css`
      color: ${theme.colors.primary.contrastText};
    `,
    featureButtonIconText: css`
      display: flex;
      align-items: center;
    `,
    featureButtonIconTextDisabled: css`
      opacity: 0.5;
    `,
    featureButtonIconTextSecondary: css`
      color: ${theme.colors.secondary.contrastText};
    `,
    featureButtonIconTextPrimary: css`
      color: ${theme.colors.primary.contrastText};
    `,
    fulfilledBadge: css`
      display: inline-flex;
      align-items: center;
      background-color: ${theme.colors.success.main};
      color: ${theme.colors.success.contrastText};
      padding: ${theme.spacing(0.5, 1)};
      border-radius: ${theme.shape.borderRadius(1)};
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.fontWeightMedium};
      margin-left: ${theme.spacing(1)};
    `,
    fulfilledStepContent: css`
      background-color: ${theme.colors.success.transparent};
      border-left: 3px solid ${theme.colors.success.main};
      padding: ${theme.spacing(1, 2)};
      margin-bottom: ${theme.spacing(2)};
    `,
    fulfilledIcon: css`
      color: ${theme.colors.success.text};
      margin-right: ${theme.spacing(0.5)};
    `,
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

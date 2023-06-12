import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { CallToActionCard, IconName, LinkButton, useStyles2 } from '@grafana/ui';

export interface Props {
  title: string;
  buttonIcon: IconName;
  buttonLink?: string;
  buttonTitle: string;
  buttonDisabled?: boolean;
  description?: string;
  onClick?: () => void;
}

const ConfigureAuthCTA: React.FunctionComponent<Props> = ({
  title,
  buttonIcon,
  buttonLink,
  buttonTitle,
  buttonDisabled,
  description,
  onClick,
}) => {
  const styles = useStyles2(getStyles);
  const footer = description ? <span key="proTipFooter">{description}</span> : '';
  const ctaElementClassName = !description ? styles.button : '';

  const ctaElement = (
    <LinkButton
      size="lg"
      href={buttonLink}
      icon={buttonIcon}
      className={ctaElementClassName}
      data-testid={selectors.components.CallToActionCard.buttonV2(buttonTitle)}
      disabled={buttonDisabled}
      onClick={() => onClick && onClick()}
    >
      {buttonTitle}
    </LinkButton>
  );

  return <CallToActionCard className={styles.cta} message={title} footer={footer} callToActionElement={ctaElement} />;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    cta: css`
      text-align: center;
    `,
    button: css`
      margin-bottom: ${theme.spacing(2.5)};
    `,
  };
};

export default ConfigureAuthCTA;

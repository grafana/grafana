import { css } from '@emotion/css';
import { MouseEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { Alert, Button, CallToActionCard, Icon, IconName, LinkButton } from '@grafana/ui';

export interface Props {
  title: string;
  buttonIcon: IconName;
  buttonLink?: string;
  buttonTitle: string;
  buttonDisabled?: boolean;
  onClick?: (event: MouseEvent) => void;
  proTip?: string;
  proTipLink?: string;
  proTipLinkTitle?: string;
  proTipTarget?: string;
  infoBox?: { __html: string };
  infoBoxTitle?: string;
}

const ctaStyle = css({
  textAlign: 'center',
});

const infoBoxStyles = css({
  maxWidth: '700px',
  margin: '0 auto',
});

const EmptyListCTA = ({
  title,
  buttonIcon,
  buttonLink,
  buttonTitle,
  buttonDisabled,
  onClick,
  proTip,
  proTipLink,
  proTipLinkTitle,
  proTipTarget,
  infoBox,
  infoBoxTitle,
}: Props) => {
  const footer = () => {
    return (
      <>
        {proTip ? (
          <span key="proTipFooter">
            <Icon name="rocket" />
            <Trans i18nKey="empty-list-cta.pro-tip">ProTip: {{ proTip }}</Trans>
            {proTipLink && (
              <a href={proTipLink} target={proTipTarget} className="text-link">
                {proTipLinkTitle}
              </a>
            )}
          </span>
        ) : (
          ''
        )}
        {infoBox ? (
          <Alert severity="info" title={infoBoxTitle ?? ''} className={infoBoxStyles}>
            <div dangerouslySetInnerHTML={infoBox} />
          </Alert>
        ) : (
          ''
        )}
      </>
    );
  };

  const ctaElementClassName = !footer()
    ? css({
        marginBottom: '20px',
      })
    : '';

  const ButtonEl = buttonLink ? LinkButton : Button;
  const ctaElement = (
    <ButtonEl
      size="lg"
      onClick={onClick}
      href={buttonLink}
      icon={buttonIcon}
      className={ctaElementClassName}
      data-testid={selectors.components.CallToActionCard.buttonV2(buttonTitle)}
      disabled={buttonDisabled}
    >
      {buttonTitle}
    </ButtonEl>
  );

  return <CallToActionCard className={ctaStyle} message={title} footer={footer()} callToActionElement={ctaElement} />;
};

export default EmptyListCTA;

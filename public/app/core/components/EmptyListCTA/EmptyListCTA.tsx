import { css } from '@emotion/css';
import React, { MouseEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Button, CallToActionCard, Icon, IconName, LinkButton } from '@grafana/ui';

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

const ctaStyle = css`
  text-align: center;
`;

const infoBoxStyles = css`
  max-width: 700px;
  margin: 0 auto;
`;

const EmptyListCTA: React.FunctionComponent<Props> = ({
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
}) => {
  const footer = () => {
    return (
      <>
        {proTip ? (
          <span key="proTipFooter">
            <Icon name="rocket" />
            <> ProTip: {proTip} </>
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
          <div key="infoBoxHtml" className={`grafana-info-box ${infoBoxStyles}`}>
            {infoBoxTitle && <h5>{infoBoxTitle}</h5>}
            <div dangerouslySetInnerHTML={infoBox} />
          </div>
        ) : (
          ''
        )}
      </>
    );
  };

  const ctaElementClassName = !footer()
    ? css`
        margin-bottom: 20px;
      `
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

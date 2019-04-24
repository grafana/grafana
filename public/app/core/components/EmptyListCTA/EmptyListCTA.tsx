import React, { useContext } from 'react';
import { CallToActionCard, LargeLinkButton, ThemeContext } from '@grafana/ui';
import { css } from 'emotion';
export interface Props {
  model: any;
}

const EmptyListCTA: React.FunctionComponent<Props> = props => {
  const theme = useContext(ThemeContext);

  const {
    title,
    buttonIcon,
    buttonLink,
    buttonTitle,
    onClick,
    proTip,
    proTipLink,
    proTipLinkTitle,
    proTipTarget,
  } = props.model;

  const footer = proTip ? (
    <span>
      <i className="fa fa-rocket" />
      <> ProTip: {proTip} </>
      <a href={proTipLink} target={proTipTarget} className="text-link">
        {proTipLinkTitle}
      </a>
    </span>
  ) : null;

  const ctaElementClassName = !footer
    ? css`
        margin-bottom: 20px;
      `
    : '';

  const ctaElement = (
    <LargeLinkButton onClick={onClick} href={buttonLink} icon={buttonIcon} className={ctaElementClassName}>
      {buttonTitle}
    </LargeLinkButton>
  );

  return <CallToActionCard message={title} footer={footer} callToActionElement={ctaElement} theme={theme} />;
};

export default EmptyListCTA;

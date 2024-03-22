import React from 'react';

import { Button, LinkButton } from '../Button';

interface LinkButtonProps {
  buttonHref: string;
  buttonLabel: string;
  onButtonClick?: never;
}

interface ButtonProps {
  buttonHref?: never;
  buttonLabel: string;
  onButtonClick: () => void;
}

type Props = LinkButtonProps | ButtonProps;

export const EmptyStateCTAButton = ({ buttonHref, buttonLabel, onButtonClick }: Props) => {
  const ButtonElement = buttonHref ? LinkButton : Button;

  return (
    <ButtonElement size="lg" href={buttonHref} onClick={onButtonClick}>
      {buttonLabel}
    </ButtonElement>
  );
};

EmptyStateCTAButton.displayName = 'EmptyStateCTAButton';

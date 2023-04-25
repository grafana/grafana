import React, { FC } from 'react';

import { Cross, DisabledSquare, EnabledSquare, MinusSquare, PlusSquare } from './icons';
import { AvailableIcons, Icons } from './types';

// TODO: improve this mapping
const icons: Icons = {
  plusSquare: PlusSquare,
  minusSquare: MinusSquare,
  selectedSquare: EnabledSquare,
  unselectedSquare: DisabledSquare,
  cross: Cross,
};

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: AvailableIcons;
}

export const Icon: FC<IconProps> = (props) => {
  // eslint-disable-next-line react/destructuring-assignment
  const IconComponent = icons[props.name];

  return <IconComponent {...props} />;
};

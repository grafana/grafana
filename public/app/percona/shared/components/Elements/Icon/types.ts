import React, { FC } from 'react';

export type AvailableIcons = 'plusSquare' | 'minusSquare' | 'selectedSquare' | 'unselectedSquare' | 'cross';

export type Icons = {
  [I in AvailableIcons]: FC<React.PropsWithChildren<React.SVGProps<SVGSVGElement>>>;
};

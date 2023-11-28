import { FC, PropsWithChildren } from 'react';

import { DetailsRowContent } from './DetailsRowContent';

export interface DetailsRowContentProps {
  title: string;
  fullRow?: boolean;
}

export interface DetailsRowType extends FC<PropsWithChildren> {
  Contents: typeof DetailsRowContent;
}

import { FC, PropsWithChildren } from 'react';

import { DetailsRowContent } from './DetailsRowContent';

export interface DetailsRowContentProps extends PropsWithChildren {
  title: string;
  fullRow?: boolean;
}

export interface DetailsRowType extends FC<PropsWithChildren> {
  Contents: typeof DetailsRowContent;
}

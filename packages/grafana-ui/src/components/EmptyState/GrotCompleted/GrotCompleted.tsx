import { type SVGProps } from 'react';
import SVG from 'react-inlinesvg';

import grotCompletedSvg from './grot-completed.svg';

export interface Props {
  width?: SVGProps<SVGElement>['width'];
  height?: SVGProps<SVGElement>['height'];
  className?: SVGProps<SVGElement>['className'];
}

export const GrotCompleted = ({ width = 'auto', height, className }: Props) => {
  // Decorative: it's always shown next to a message that carries the meaning.
  return <SVG src={grotCompletedSvg} className={className} height={height} width={width} aria-hidden />;
};

GrotCompleted.displayName = 'GrotCompleted';

import { ThemeSpacingTokens } from '@grafana/data';

import { Box } from './Box/Box';
import { ResponsiveProp } from './utils/responsiveness';

export interface SpaceProps {
  /**
   * The amount of vertical space to use.
   */
  v?: ResponsiveProp<ThemeSpacingTokens>;
  /**
   * The amount of horizontal space to use.
   */
  h?: ResponsiveProp<ThemeSpacingTokens>;
  /**
   * The layout of the space. If set to `inline`, the component will behave like an inline-block element,
   * otherwise it will behave like a block element.
   */
  layout?: 'block' | 'inline';
}

export const Space = ({ v = 0, h = 0, layout }: SpaceProps) => {
  return <Box paddingRight={h} paddingBottom={v} display={layout === 'inline' ? 'inline-block' : 'block'} />;
};

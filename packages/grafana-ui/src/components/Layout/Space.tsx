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

/**
 * The Space component is a component used to add space between elements. Horizontal space is added using the `h` prop, while vertical space is added using the `v` prop. When adding horizontal space between inline or inline-block elements, the `layout` prop should be set to `"inline"`, otherwise the `"block"` value of the prop can be used.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/layout-space--docs
 */
export const Space = ({ v = 0, h = 0, layout }: SpaceProps) => {
  return <Box paddingRight={h} paddingBottom={v} display={layout === 'inline' ? 'inline-block' : 'block'} />;
};

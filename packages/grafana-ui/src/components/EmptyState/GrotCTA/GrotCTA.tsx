import { css } from '@emotion/css';
import { type SVGProps } from 'react';
import SVG from 'react-inlinesvg';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';

import grotCTASvg from './grot-cta.svg';

export interface Props {
  width?: SVGProps<SVGElement>['width'];
  height?: SVGProps<SVGElement>['height'];
}

export const GrotCTA = ({ width = 'auto', height }: Props) => {
  const styles = useStyles2(getStyles);

  // @ts-expect-error react-inlinesvg@4.3.0 return type includes bigint, which isn't in @types/react@18's ReactNode. Remove when we update @types/react.
  return <SVG src={grotCTASvg} className={styles.svg} height={height} width={width} />;
};

GrotCTA.displayName = 'GrotCTA';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    svg: css({
      '#grot-cta-cactus-1, #grot-cta-cactus-2': {
        fill: theme.isDark ? '#58558c' : '#c9c5f4',
      },
    }),
  };
};

import { css } from '@emotion/css';
import { SVGProps } from 'react';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';

import grotCTASvg from './grot-cta.svg';

export interface Props {
  width?: SVGProps<SVGElement>['width'];
  height?: SVGProps<SVGElement>['height'];
}

export const GrotCTA = ({ width = 'auto', height }: Props) => {
  const styles = useStyles2(getStyles);

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

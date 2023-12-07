import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { default as grot0 } from './assets/grotLevel0.svg';
import { default as grot1 } from './assets/grotLevel1.svg';
import { default as grot2 } from './assets/grotLevel2.svg';
import { default as grot3 } from './assets/grotLevel3.svg';
import { default as grot4 } from './assets/grotLevel4.svg';
import { default as grot5 } from './assets/grotLevel5.svg';

interface GrotLevelProps {
  level: number;
  height?: number;
  width?: number;
}

export const GrotIcon = ({ level, height, width }: GrotLevelProps) => {
  const styles = useStyles2(getStyles);
  const grotIcon = () => {
    switch (level) {
      case 0:
        return grot0;
      case 1:
        return grot1;
      case 2:
        return grot2;
      case 3:
        return grot3;
      case 4:
        return grot4;
      case 5:
        return grot5;
      default:
        return grot0;
    }
  };

  return <img className={styles.image} src={grotIcon()} alt={'grot icon'} height={height} width={width} />;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    image: css({
      paddingRight: '5px',
    }),
  };
};

import { css } from '@emotion/css';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { getResponsiveStyle, ResponsiveProp } from '../Layout/utils/responsiveness';

export interface AvatarProps {
  src: string;
  alt: string;
  width?: ResponsiveProp<ThemeSpacingTokens>;
  height?: ResponsiveProp<ThemeSpacingTokens>;
}
export const Avatar = ({ src, alt, width, height }: AvatarProps) => {
  const styles = useStyles2(getStyles, width, height);

  return <img className={styles.image} src={src} alt={alt} />;
};

const getStyles = (theme: GrafanaTheme2, width: AvatarProps['width'] = 3, height: AvatarProps['height'] = 3) => {
  return {
    image: css([
      getResponsiveStyle(theme, width, (val) => ({
        width: theme.spacing(val),
      })),
      getResponsiveStyle(theme, height, (val) => ({
        height: theme.spacing(val),
      })),
      { borderRadius: theme.shape.radius.circle },
    ]),
  };
};

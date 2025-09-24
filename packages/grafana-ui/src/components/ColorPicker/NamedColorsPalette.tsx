import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';

import { ColorSwatch } from './ColorSwatch';
import NamedColorsGroup from './NamedColorsGroup';

export interface NamedColorsPaletteProps {
  color?: string;
  onChange: (colorName: string) => void;
}

export const NamedColorsPalette = ({ color, onChange }: NamedColorsPaletteProps) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const swatches: JSX.Element[] = [];
  for (const hue of theme.visualization.hues) {
    swatches.push(<NamedColorsGroup key={hue.name} selectedColor={color} hue={hue} onColorSelect={onChange} />);
  }

  return (
    <>
      <div className={styles.swatches}>{swatches}</div>
      <div className={styles.extraColors}>
        <ColorSwatch
          isSelected={color === 'transparent'}
          color={'rgba(0,0,0,0)'}
          label={t('grafana-ui.named-colors-palette.transparent-swatch', 'Transparent')}
          onClick={() => onChange('transparent')}
        />
        <ColorSwatch
          isSelected={color === 'text'}
          color={theme.colors.text.primary}
          label={t('grafana-ui.named-colors-palette.text-color-swatch', 'Text color')}
          onClick={() => onChange('text')}
        />
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    extraColors: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 0),
    }),
    swatches: css({
      display: 'grid',
      flexGrow: 1,
    }),
  };
};

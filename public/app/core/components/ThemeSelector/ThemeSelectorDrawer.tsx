import { css } from '@emotion/css';

import { GrafanaTheme2, ThemeRegistryItem } from '@grafana/data';
import { Drawer, RadioButtonDot, TextLink, useStyles2, useTheme2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { changeTheme } from 'app/core/services/theme';

import { ThemePreview } from '../Theme/ThemePreview';

import { getSelectableThemes } from './getSelectableThemes';

interface Props {
  onClose: () => void;
}

export function ThemeSelectorDrawer({ onClose }: Props) {
  const styles = useStyles2(getStyles);
  const themes = getSelectableThemes();
  const currentTheme = useTheme2();

  const onChange = (theme: ThemeRegistryItem) => {
    changeTheme(theme.id, false);
  };

  const subTitle = (
    <Trans i18nKey="shared-preferences.fields.theme-description">
      Enjoying the limited edition themes? Tell us what you'd like to see{' '}
      <TextLink
        variant="bodySmall"
        external
        href="https://docs.google.com/forms/d/e/1FAIpQLSeRKAY8nUMEVIKSYJ99uOO-dimF6Y69_If1Q1jTLOZRWqK1cw/viewform?usp=dialog"
      >
        here.
      </TextLink>
    </Trans>
  );

  return (
    <Drawer title={t('profile.change-theme', 'Change theme')} onClose={onClose} size="md" subtitle={subTitle}>
      <div className={styles.grid} role="radiogroup">
        {themes.map((themeOption) => (
          <ThemeCard
            themeOption={themeOption}
            key={themeOption.id}
            onSelect={() => onChange(themeOption)}
            isSelected={currentTheme.name === themeOption.name}
          />
        ))}
      </div>
    </Drawer>
  );
}

interface ThemeCardProps {
  themeOption: ThemeRegistryItem;
  isSelected?: boolean;
  onSelect: () => void;
}

function ThemeCard({ themeOption, isSelected, onSelect }: ThemeCardProps) {
  const theme = themeOption.build();
  const label = getTranslatedThemeName(themeOption);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.card} onClick={onSelect}>
      <div className={styles.header}>
        <RadioButtonDot
          id={`theme-${theme.name}`}
          name={'theme'}
          label={label}
          onChange={onSelect}
          checked={isSelected}
        />
      </div>
      <ThemePreview theme={theme} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    grid: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gridAutoRows: `250px`,
      gap: theme.spacing(2),
    }),
    card: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      display: 'flex',
      flexDirection: 'column',
      cursor: 'pointer',
      '&:hover': {
        border: `1px solid ${theme.colors.border.medium}`,
      },
    }),
    header: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(1),
      // The RadioButtonDot is not correctly implemented at the moment, missing cursor (And click ability for the label and input)
      '> label': {
        cursor: 'pointer',
      },
    }),
  };
};

function getTranslatedThemeName(theme: ThemeRegistryItem) {
  switch (theme.id) {
    case 'dark':
      return t('shared.preferences.theme.dark-label', 'Dark');
    case 'light':
      return t('shared.preferences.theme.light-label', 'Light');
    case 'system':
      return t('shared.preferences.theme.system-label', 'System preference');
    default:
      return theme.name;
  }
}

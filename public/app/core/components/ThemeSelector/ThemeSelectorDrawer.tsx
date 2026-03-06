import { css } from '@emotion/css';

import { GrafanaTheme2, ThemeRegistryItem } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Drawer, Text, useStyles2, useTheme2 } from '@grafana/ui';
import { changeTheme } from 'app/core/services/theme';

import { useSelectableThemes } from '../../../features/themes/utils';

import { ThemeCard } from './ThemeCard';

interface Props {
  onClose: () => void;
}

export function ThemeSelectorDrawer({ onClose }: Props) {
  const styles = useStyles2(getStyles);
  const themes = useSelectableThemes();
  const currentTheme = useTheme2();

  const onChange = (theme: ThemeRegistryItem) => {
    reportInteraction('grafana_preferences_theme_changed', {
      toTheme: theme.id,
      preferenceType: 'theme_drawer',
    });
    changeTheme(theme.id, false);
  };

  return (
    <Drawer title={t('profile.change-theme', 'Change theme')} onClose={onClose} size="md">
      <div className={styles.container} role="radiogroup">
        <div className={styles.grid}>
          {themes
            .filter((themeOption) => !themeOption.isExtra)
            .map((themeOption) => (
              <ThemeCard
                themeOption={themeOption}
                key={themeOption.id}
                onSelect={() => onChange(themeOption)}
                isSelected={currentTheme.name === themeOption.name}
              />
            ))}
        </div>
        <Text variant="h4">
          <Trans i18nKey="profile.custom-themes.subheading">Custom themes</Trans>
        </Text>
        <div className={styles.grid}>
          {themes
            .filter((themeOption) => themeOption.isExtra)
            .map((themeOption) => (
              <ThemeCard
                themeOption={themeOption}
                key={themeOption.id}
                onSelect={() => onChange(themeOption)}
                isSelected={currentTheme.name === themeOption.name}
              />
            ))}
        </div>
      </div>
    </Drawer>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    grid: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gridAutoRows: `250px`,
      gap: theme.spacing(2),
    }),
  };
};

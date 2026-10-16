import { css } from '@emotion/css';

import { type GrafanaTheme2, type ThemeRegistryItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Drawer, useStyles2, useTheme2 } from '@grafana/ui';
import { changeTheme } from 'app/core/services/theme';

import { VisualRefreshInfo } from '../../../features/visual-refresh/components/VisualRefreshInfo/VisualRefreshInfo';

import { ThemeCard } from './ThemeCard';
import { getSelectableThemes } from './getSelectableThemes';

interface Props {
  onClose: () => void;
}

export function ThemeSelectorDrawer({ onClose }: Props) {
  const styles = useStyles2(getStyles);
  const themes = getSelectableThemes();
  const currentTheme = useTheme2();

  const onChange = (theme: ThemeRegistryItem) => {
    reportInteraction('grafana_preferences_theme_changed', {
      toTheme: theme.id,
      preferenceType: 'theme_drawer',
    });
    changeTheme(theme.id, false);
  };

  return (
    <Drawer
      title={t('profile.change-theme', 'Change theme')}
      onClose={onClose}
      size="md"
      subtitle={<VisualRefreshInfo />}
    >
      <div className={styles.grid} role="radiogroup">
        {themes.map((themeOption) => (
          <ThemeCard
            themeOption={themeOption}
            isExperimental={themeOption.isExtra}
            key={themeOption.id}
            onSelect={() => onChange(themeOption)}
            isSelected={currentTheme.name === themeOption.name}
          />
        ))}
      </div>
    </Drawer>
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
  };
};

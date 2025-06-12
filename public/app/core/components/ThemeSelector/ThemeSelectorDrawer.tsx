import { css } from '@emotion/css';

import { GrafanaTheme2, ThemeRegistryItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Drawer, TextLink, useStyles2, useTheme2 } from '@grafana/ui';
import { changeTheme } from 'app/core/services/theme';

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

  const subTitle = (
    <Trans i18nKey="shared-preferences.fields.theme-description">
      Enjoying the experimental themes? Tell us what you'd like to see{' '}
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
    <Drawer
      title={t('profile.change-theme', 'Change theme')}
      onClose={onClose}
      size="md"
      subtitle={config.feedbackLinksEnabled ? subTitle : undefined}
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

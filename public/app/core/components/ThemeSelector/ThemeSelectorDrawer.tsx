import { css } from '@emotion/css';

import { GrafanaTheme2, ThemeContext, ThemeRegistryItem } from '@grafana/data';
import { Box, Drawer, RadioButtonDot, useStyles2, useTheme2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { changeTheme } from 'app/core/services/theme';

import { Branding } from '../Branding/Branding';

import { getSelectableThemes } from './getSelectableThemes';

interface Props {
  onClose: () => void;
}

export function ThemeSelectorDrawer({ onClose }: Props) {
  const styles = useStyles2(getStyles);
  const themes = getSelectableThemes();
  const currentTheme = useTheme2();

  const onChange = (theme: ThemeRegistryItem) => {
    changeTheme(theme.id, true);
  };

  return (
    <Drawer title="Change theme" onClose={onClose} size="md">
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
      <ThemeContext.Provider value={theme}>
        <ThemePreview />
      </ThemeContext.Provider>
    </div>
  );
}

function ThemePreview() {
  //const theme = useTheme2();
  const styles = useStyles2(getDemoStyles);

  return (
    <Box backgroundColor={'canvas'} display={'flex'} direction={'column'} grow={1}>
      <div className={styles.topNav}>
        <Branding.MenuLogo className={styles.img} />
        <div className={styles.breadcrumbs}>Home / Dashboards</div>
        <div style={{ flexGrow: 1 }} />
        <div className={styles.formInput} />
        <div className={styles.profileCircle} />
      </div>
      <div className={styles.body}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>Panel</div>
          <div className={styles.panelBody}>
            <div className={styles.formLabel}>Form label</div>
            <div className={styles.formInput} />
          </div>
          <div className={styles.panelActions}>
            <div className={styles.actionSecondary} />
            <div className={styles.actionDanger} />
            <div className={styles.actionPrimary} />
          </div>
        </div>
      </div>
    </Box>
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

const getDemoStyles = (theme: GrafanaTheme2) => {
  return {
    topNav: css({
      background: theme.colors.background.primary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      height: 24,
      display: 'flex',
      padding: 4,
      gap: 4,
      alignItems: 'center',
    }),
    breadcrumbs: css({
      fontSize: '5px',
      paddingLeft: 4,
      color: theme.colors.text.primary,
    }),
    profileCircle: css({
      background: theme.colors.text.secondary,
      height: '8px',
      width: '8px',
      marginLeft: 4,
      borderRadius: theme.shape.radius.circle,
    }),
    body: css({
      padding: 24,
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
    }),
    img: css({
      width: 10,
      height: 10,
    }),
    panel: css({
      background: theme.components.panel.background,
      border: `1px solid ${theme.components.panel.borderColor}`,
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      borderRadius: theme.shape.radius.default,
    }),
    panelHeader: css({
      height: 20,
      fontSize: '5px',
      color: theme.colors.text.primary,
      padding: 4,
    }),
    panelBody: css({
      flexGrow: 1,
      padding: 4,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }),
    panelActions: css({
      display: 'flex',
      gap: 4,
      padding: 8,
      justifyContent: 'flex-end',
      ' > div': {
        height: 8,
        width: 20,
        borderRadius: theme.shape.radius.default,
      },
    }),
    formLabel: css({
      fontSize: '5px',
      color: theme.colors.text.primary,
    }),
    formInput: css({
      height: 8,
      width: 50,
      background: theme.components.input.background,
      border: `1px solid ${theme.colors.border.medium}`,
    }),
    actionSecondary: css({
      background: theme.colors.secondary.main,
    }),
    actionDanger: css({
      background: theme.colors.error.main,
    }),
    actionPrimary: css({
      background: theme.colors.primary.main,
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

import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2, type NewThemeOptions } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { Page } from '../../core/components/Page/Page';
import { HOME_NAV_ID } from '../../core/reducers/navModel';
import { getNavModel } from '../../core/selectors/navModel';
import { useSelector } from '../../types/store';

import { DesignSidebar } from './components/DesignSidebar/DesignSidebar';
import { PreviewPane } from './components/PreviewPane/PreviewPane';
import { baseThemeMap } from './state/baseThemes';
import { buildPreviewTheme, cloneThemeOptions, setFieldValue } from './state/themeStudioModel';

export default function ThemeStudioPage() {
  const navIndex = useSelector((state) => state.navIndex);
  const homeNav = getNavModel(navIndex, HOME_NAV_ID).main;
  const navModel = {
    text: t('theme-studio.title', 'Theme Studio'),
    subTitle: t('theme-studio.subtitle', 'Load a theme, tweak it live, then copy the theme JSON.'),
    parentItem: homeNav,
  };

  const styles = useStyles2(getStyles);
  const currentTheme = useTheme2();
  const initialBaseId: string = currentTheme.colors.mode;

  const [baseThemeId, setBaseThemeId] = useState<string>(initialBaseId);
  const [options, setOptions] = useState<NewThemeOptions>(() => cloneThemeOptions(baseThemeMap[initialBaseId]));
  const [loadKey, setLoadKey] = useState(0);

  const derived = useMemo(() => buildPreviewTheme(options, currentTheme), [options, currentTheme]);

  const handleChange = (path: string, value: string | number | undefined) => {
    setOptions((previous) => setFieldValue(previous, path, value));
  };

  const handleLoadBase = (themeId: string) => {
    const base = baseThemeMap[themeId];
    if (!base) {
      return;
    }
    setBaseThemeId(themeId);
    setOptions(cloneThemeOptions(base));
    setLoadKey((key) => key + 1);
  };

  return (
    <Page navModel={{ node: navModel, main: navModel }}>
      <Page.Contents>
        <div className={styles.layout}>
          <DesignSidebar
            options={options}
            derived={derived}
            baseThemeId={baseThemeId}
            resetKey={loadKey}
            onLoadBase={handleLoadBase}
            onChange={handleChange}
          />
          <PreviewPane theme={derived} />
        </div>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  layout: css({
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: theme.spacing(2),
    [theme.breakpoints.up('lg')]: {
      gridTemplateColumns: '380px 1fr',
      gap: 0,
      minHeight: '70vh',
    },
  }),
});

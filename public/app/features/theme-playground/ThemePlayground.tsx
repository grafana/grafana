import { getThemeById } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ThemeDemo } from '@grafana/ui/internal';
import { Page } from 'app/core/components/Page/Page';

import { HOME_NAV_ID } from '../../core/reducers/navModel';
import { getNavModel } from '../../core/selectors/navModel';
import { ThemeProvider } from '../../core/utils/ConfigProvider';
import { useSelector } from '../../types/store';

export default function ThemePlayground() {
  const navIndex = useSelector((state) => state.navIndex);
  const homeNav = getNavModel(navIndex, HOME_NAV_ID).main;
  const navModel = {
    text: t('theme-playground.title', 'Theme playground'),
    parentItem: homeNav,
  };
  const theme = getThemeById('tron');
  return (
    <Page
      navModel={{
        node: navModel,
        main: navModel,
      }}
    >
      <ThemeProvider value={theme}>
        <ThemeDemo />
      </ThemeProvider>
    </Page>
  );
}

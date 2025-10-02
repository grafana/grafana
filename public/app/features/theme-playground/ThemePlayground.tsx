import { css } from '@emotion/css';
import { useState } from 'react';

import { AppEvents, createTheme, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useChromeHeaderHeight } from '@grafana/runtime';
import { CodeEditor, Stack, useStyles2 } from '@grafana/ui';
import { ThemeDemo } from '@grafana/ui/internal';
import { Page } from 'app/core/components/Page/Page';

import tron from '../../../../packages/grafana-data/src/themes/themeDefinitions/tron';
import appEvents from '../../core/app_events';
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
  const [theme, setTheme] = useState(tron);
  const chromeHeaderHeight = useChromeHeaderHeight();
  const styles = useStyles2(getStyles, chromeHeaderHeight);

  const onBlur = (value: string) => {
    try {
      const themeInput = JSON.parse(value);
      setTheme(themeInput);
    } catch (error) {
      appEvents.emit(AppEvents.alertError, ['Failed to modify theme', error]);
    }
  };

  return (
    <Page
      navModel={{
        node: navModel,
        main: navModel,
      }}
    >
      <Stack
        direction={{
          xs: 'column',
          md: 'row',
        }}
        height="100%"
      >
        <CodeEditor
          width="100%"
          value={JSON.stringify(theme, null, 2)}
          language="json"
          showLineNumbers={true}
          showMiniMap={true}
          containerStyles={styles.codeEditor}
          onBlur={onBlur}
          monacoOptions={{
            alwaysConsumeMouseWheel: true,
          }}
        />
        <ThemeProvider value={createTheme(theme)}>
          <ThemeDemo />
        </ThemeProvider>
      </Stack>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2, chromeHeaderHeight: number | undefined) => ({
  codeEditor: css({
    height: '40vh',
    minWidth: '300px',
    position: 'sticky',
    top: chromeHeaderHeight ? `calc(${chromeHeaderHeight}px + ${theme.spacing(4)})` : 0,
    width: '100%',
    zIndex: theme.zIndex.activePanel,
    [theme.breakpoints.up('md')]: {
      height: `calc(90vh - ${chromeHeaderHeight ?? 0}px - ${theme.spacing(2)})`,
      width: '70%',
    },
  }),
});

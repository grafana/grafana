import { css } from '@emotion/css';
import { useId, useState } from 'react';

import { AppEvents, createTheme, GrafanaTheme2 } from '@grafana/data';
import { experimentalThemeDefinitions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { useChromeHeaderHeight } from '@grafana/runtime';
import { CodeEditor, Combobox, Field, Stack, useStyles2 } from '@grafana/ui';
import { ThemeDemo } from '@grafana/ui/internal';
import { Page } from 'app/core/components/Page/Page';

import appEvents from '../../core/app_events';
import { HOME_NAV_ID } from '../../core/reducers/navModel';
import { getNavModel } from '../../core/selectors/navModel';
import { ThemeProvider } from '../../core/utils/ConfigProvider';
import { useSelector } from '../../types/store';

import schema from './schema.generated.json';

const themeOptions = [
  {
    label: 'Dark',
    value: JSON.stringify(
      {
        name: 'Dark',
        colors: {
          mode: 'dark',
        },
      },
      null,
      2
    ),
  },
  {
    label: 'Light',
    value: JSON.stringify(
      {
        name: 'Light',
        colors: {
          mode: 'light',
        },
      },
      null,
      2
    ),
  },
  ...Object.values(experimentalThemeDefinitions).map((theme) => ({
    label: theme.name,
    value: JSON.stringify(theme, null, 2),
  })),
];

export default function ThemePlayground() {
  const navIndex = useSelector((state) => state.navIndex);
  const homeNav = getNavModel(navIndex, HOME_NAV_ID).main;
  const navModel = {
    text: t('theme-playground.title', 'Theme playground'),
    parentItem: homeNav,
  };
  const baseId = useId();
  const [baseTheme, setBaseTheme] = useState(themeOptions[0].value);
  const [theme, setTheme] = useState(createTheme(JSON.parse(baseTheme)));
  const chromeHeaderHeight = useChromeHeaderHeight();
  const styles = useStyles2(getStyles, chromeHeaderHeight);

  const onBlur = (value: string) => {
    try {
      const themeInput = JSON.parse(value);
      try {
        setTheme(createTheme(themeInput));
      } catch (error) {
        appEvents.emit(AppEvents.alertError, ['Failed to create theme', error]);
      }
    } catch (error) {
      appEvents.emit(AppEvents.alertError, ['Failed to parse JSON', error]);
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
        columnGap={2}
        rowGap={1}
        height="100%"
      >
        <div className={styles.left}>
          <Field noMargin label={t('theme-playground.label-base-theme', 'Base theme')}>
            <Combobox
              value={baseTheme}
              onChange={(option) => {
                setBaseTheme(option.value);
                onBlur(option.value);
              }}
              options={themeOptions}
              id={baseId}
            />
          </Field>
          <CodeEditor
            width="100%"
            value={baseTheme}
            language="json"
            showLineNumbers={true}
            showMiniMap={true}
            containerStyles={styles.codeEditor}
            onBlur={onBlur}
            onBeforeEditorMount={(monaco) => {
              monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                validate: true,
                schemas: [
                  {
                    uri: 'theme-schema',
                    fileMatch: ['*'],
                    schema,
                  },
                ],
              });
            }}
            monacoOptions={{
              alwaysConsumeMouseWheel: true,
              minimap: {
                enabled: false,
              },
            }}
          />
        </div>
        <ThemeProvider value={theme}>
          <ThemeDemo />
        </ThemeProvider>
      </Stack>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2, chromeHeaderHeight: number | undefined) => ({
  left: css({
    background: theme.colors.background.primary,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    height: '40vh',
    minWidth: '300px',
    padding: theme.spacing(2, 0),
    position: 'sticky',
    top: chromeHeaderHeight ?? 0,
    width: '100%',
    [theme.breakpoints.up('md')]: {
      height: `calc(90vh - ${chromeHeaderHeight ?? 0}px - ${theme.spacing(2)})`,
      width: '70%',
    },
    zIndex: theme.zIndex.activePanel,
  }),
  codeEditor: css({
    flex: 1,
  }),
});

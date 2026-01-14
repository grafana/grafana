import { css } from '@emotion/css';
import { useId, useState } from 'react';

import { createTheme, GrafanaTheme2, NewThemeOptions } from '@grafana/data';
import { experimentalThemeDefinitions, NewThemeOptionsSchema } from '@grafana/data/internal';
import { themeJsonSchema } from '@grafana/data/unstable';
import { t } from '@grafana/i18n';
import { useChromeHeaderHeight } from '@grafana/runtime';
import { CodeEditor, Combobox, Field, Stack, useStyles2 } from '@grafana/ui';
import { ThemeDemo } from '@grafana/ui/internal';
import { Page } from 'app/core/components/Page/Page';

import { createErrorNotification } from '../../core/copy/appNotification';
import { notifyApp } from '../../core/reducers/appNotification';
import { HOME_NAV_ID } from '../../core/reducers/navModel';
import { getNavModel } from '../../core/selectors/navModel';
import { ThemeProvider } from '../../core/utils/ConfigProvider';
import { useDispatch, useSelector } from '../../types/store';

const themeMap: Record<string, NewThemeOptions> = {
  dark: {
    name: 'Dark',
    id: 'dark',
    colors: {
      mode: 'dark',
    },
  },
  light: {
    name: 'Light',
    id: 'light',
    colors: {
      mode: 'light',
    },
  },
};

// Add additional themes
for (const [name, json] of Object.entries(experimentalThemeDefinitions)) {
  const result = NewThemeOptionsSchema.safeParse(json);
  if (!result.success) {
    console.error(`Invalid theme definition for theme ${name}: ${result.error.message}`);
  } else {
    themeMap[result.data.id] = result.data;
  }
}

const themeOptions = Object.entries(themeMap).map(([key, theme]) => ({
  label: theme.name,
  value: key,
}));

export default function ThemePlayground() {
  const navIndex = useSelector((state) => state.navIndex);
  const homeNav = getNavModel(navIndex, HOME_NAV_ID).main;
  const navModel = {
    text: t('theme-playground.title', 'Theme playground'),
    parentItem: homeNav,
  };
  const baseId = useId();
  const chromeHeaderHeight = useChromeHeaderHeight();
  const styles = useStyles2(getStyles, chromeHeaderHeight);
  const dispatch = useDispatch();

  const [baseThemeId, setBaseThemeId] = useState(Object.keys(themeMap)[0]);
  const [theme, setTheme] = useState(createTheme(themeMap[baseThemeId]));

  const updateThemePreview = (themeInput: NewThemeOptions) => {
    try {
      const theme = createTheme(themeInput);
      setTheme(theme);
    } catch (error) {
      dispatch(notifyApp(createErrorNotification('Failed to create theme', `${error}`)));
    }
  };

  const onEditorBlur = (value: string) => {
    try {
      const themeInput = NewThemeOptionsSchema.safeParse(JSON.parse(value));
      if (!themeInput.success) {
        dispatch(notifyApp(createErrorNotification('Failed to parse theme', themeInput.error.issues[0].message)));
      } else {
        updateThemePreview(themeInput.data);
      }
    } catch (error) {
      dispatch(notifyApp(createErrorNotification('Failed to parse JSON', `${error}`)));
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
              value={baseThemeId}
              onChange={(option) => {
                setBaseThemeId(option.value);
                updateThemePreview(themeMap[option.value]);
              }}
              options={themeOptions}
              id={baseId}
            />
          </Field>
          <CodeEditor
            width="100%"
            value={JSON.stringify(themeMap[baseThemeId], null, 2)}
            language="json"
            showLineNumbers={true}
            showMiniMap={true}
            containerStyles={styles.codeEditor}
            onBlur={onEditorBlur}
            onBeforeEditorMount={(monaco) => {
              monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                validate: true,
                schemas: [
                  {
                    uri: 'theme-schema',
                    fileMatch: ['*'],
                    schema: themeJsonSchema,
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

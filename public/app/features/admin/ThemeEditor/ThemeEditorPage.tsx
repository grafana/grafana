import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { FeatureState, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FeatureBadge, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { ThemeEditorPreview } from './ThemeEditorPreview';
import { ThemeEditorSidebar } from './ThemeEditorSidebar';
import { buildThemeFromState, DEFAULT_DARK_STATE, type ThemeEditorState } from './themeEditorState';

export default function ThemeEditorPage() {
  const styles = useStyles2(getStyles);
  const [editorState, setEditorState] = useState<ThemeEditorState>(DEFAULT_DARK_STATE);

  const previewTheme = useMemo(() => buildThemeFromState(editorState), [editorState]);

  const handleChange = useCallback((partial: Partial<ThemeEditorState>) => {
    setEditorState((prev) => ({
      ...prev,
      ...partial,
      colors: {
        ...prev.colors,
        ...(partial.colors ?? {}),
      },
    }));
  }, []);

  return (
    <Page
      navId="theme-editor"
      subTitle={
        <span className={styles.subtitle}>
          {t('theme-editor.subtitle', 'Create and preview custom Grafana themes')}
          <FeatureBadge featureState={FeatureState.experimental} />
        </span>
      }
    >
      <Page.Contents>
        <div className={styles.layout}>
          <div className={styles.sidebar}>
            <ThemeEditorSidebar state={editorState} onChange={handleChange} />
          </div>
          <div className={styles.preview}>
            <ThemeEditorPreview theme={previewTheme} />
          </div>
        </div>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  layout: css({
    display: 'grid',
    gridTemplateColumns: '380px 1fr',
    gap: theme.spacing(2),
    height: 'calc(100vh - 200px)',
    minHeight: 500,
  }),
  sidebar: css({
    overflowY: 'auto',
    borderRight: `1px solid ${theme.colors.border.weak}`,
    paddingRight: theme.spacing(2),
  }),
  preview: css({
    overflowY: 'auto',
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  subtitle: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
});

import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Drawer, Icon, IconButton, JSONFormatter, Stack, useStyles2 } from '@grafana/ui';

import { usePanelContext, useQueryEditorUIContext, useQueryRunnerContext } from './QueryEditorContext';
import { useTransformationDebugData } from './hooks/useTransformationDebugData';

export function TransformationDebugDisplay() {
  const { selectedTransformation, transformToggles } = useQueryEditorUIContext();
  const { data } = useQueryRunnerContext();
  const { transformations } = usePanelContext();

  const styles = useStyles2(getStyles);

  const seriesData = useMemo(() => data?.series ?? [], [data?.series]);

  const { input, output } = useTransformationDebugData({
    selectedTransformation,
    transformations,
    data: seriesData,
    isActive: transformToggles.showDebug,
  });

  if (!transformToggles.showDebug || !selectedTransformation) {
    return null;
  }

  return (
    <Drawer
      title={t('query-editor-next.transformation-debug.title', 'Debug transformation')}
      subtitle={selectedTransformation.registryItem?.name}
      onClose={transformToggles.toggleDebug}
    >
      <Stack direction="row" gap={1}>
        <div className={styles.debug}>
          <div className={styles.debugTitle}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Trans i18nKey="query-editor-next.transformation-debug.input-data">Input data</Trans>
              <IconButton
                name="copy"
                size="sm"
                tooltip={t('query-editor-next.transformation-debug.copy-input', 'Copy input data to clipboard')}
                aria-label={t('query-editor-next.transformation-debug.copy-input', 'Copy input data to clipboard')}
                onClick={() => navigator.clipboard.writeText(JSON.stringify(input, null, 2))}
              />
            </Stack>
          </div>
          <div className={styles.debugJson}>
            <JSONFormatter json={input} />
          </div>
        </div>
        <div className={styles.debugSeparator}>
          <Icon name="arrow-right" />
        </div>
        <div className={styles.debug}>
          <div className={styles.debugTitle}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Trans i18nKey="query-editor-next.transformation-debug.output-data">Output data</Trans>
              <IconButton
                name="copy"
                size="sm"
                tooltip={t('query-editor-next.transformation-debug.copy-output', 'Copy output data to clipboard')}
                aria-label={t('query-editor-next.transformation-debug.copy-output', 'Copy output data to clipboard')}
                onClick={() => navigator.clipboard.writeText(JSON.stringify(output, null, 2))}
              />
            </Stack>
          </div>
          <div className={styles.debugJson}>
            <JSONFormatter json={output} />
          </div>
        </div>
      </Stack>
    </Drawer>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    debugSeparator: css({
      width: '48px',
      minHeight: '300px',
      display: 'flex',
      alignItems: 'center',
      alignSelf: 'stretch',
      justifyContent: 'center',
      margin: `0 ${theme.spacing(0.5)}`,
      color: theme.colors.primary.text,
    }),
    debugTitle: css({
      padding: `${theme.spacing(1)} ${theme.spacing(0.25)}`,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      flexGrow: 0,
      flexShrink: 1,
    }),
    debug: css({
      marginTop: theme.spacing(1),
      padding: `0 ${theme.spacing(1, 1, 1)}`,
      border: `1px solid ${theme.colors.border.weak}`,
      background: `${theme.isLight ? theme.v1.palette.white : theme.v1.palette.gray05}`,
      borderRadius: theme.shape.radius.default,
      width: '100%',
      minHeight: '300px',
      display: 'flex',
      flexDirection: 'column',
      alignSelf: 'stretch',
    }),
    debugJson: css({
      flexGrow: 1,
      height: '100%',
      overflow: 'hidden',
      padding: theme.spacing(0.5),
    }),
  };
};

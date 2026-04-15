import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Icon, ScrollContainer, Stack, Text, useStyles2 } from '@grafana/ui';

import {
  useDatasourceContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from './QueryEditorContext';
import { StackedQueryItem } from './StackedQueryItem';
import { StackedTransformationItem } from './StackedTransformationItem';

export function StackedView() {
  const styles = useStyles2(getStyles);
  const { selectedQueryRefIds, selectedTransformationIds, setIsStackedView } = useQueryEditorUIContext();
  const { queries, data } = useQueryRunnerContext();
  const { dsSettings } = useDatasourceContext();
  const { transformations } = usePanelContext();

  const hasQueries = selectedQueryRefIds.length > 0;

  const selectedQueries = useMemo(() => {
    const refIds = new Set(selectedQueryRefIds);
    return queries.filter(({ refId }) => refIds.has(refId));
  }, [queries, selectedQueryRefIds]);

  const selectedTransformations = useMemo(() => {
    const ids = new Set(selectedTransformationIds);
    return transformations.filter(({ transformId }) => ids.has(transformId));
  }, [transformations, selectedTransformationIds]);

  const rawData = useMemo(() => data?.series ?? [], [data]);

  const count = hasQueries ? selectedQueries.length : selectedTransformations.length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Icon name="layers-alt" size="sm" />
          <Text variant="body" weight="medium">
            {hasQueries
              ? t('query-editor-next.stacked-view.viewing-queries', 'Viewing {{count}} queries', { count })
              : t('query-editor-next.stacked-view.viewing-transformations', 'Viewing {{count}} transformations', {
                  count,
                })}
          </Text>
        </Stack>
        <Button size="sm" variant="secondary" fill="text" icon="times" onClick={() => setIsStackedView(false)}>
          <Trans i18nKey="query-editor-next.stacked-view.exit">Exit stacked view</Trans>
        </Button>
      </div>
      <ScrollContainer>
        <div className={styles.list}>
          {hasQueries
            ? selectedQueries.map((query) => (
                <StackedQueryItem key={query.refId} query={query} panelDsSettings={dsSettings} panelData={data} />
              ))
            : selectedTransformations.map((transformation) => (
                <StackedTransformationItem
                  key={transformation.transformId}
                  transformation={transformation}
                  allTransformations={transformations}
                  rawData={rawData}
                />
              ))}
        </div>
      </ScrollContainer>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(0.5, 1.5),
    backgroundColor: theme.colors.background.secondary,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    borderTopLeftRadius: theme.shape.radius.default,
    borderTopRightRadius: theme.shape.radius.default,
    minHeight: theme.spacing(5),
  }),
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
  }),
});

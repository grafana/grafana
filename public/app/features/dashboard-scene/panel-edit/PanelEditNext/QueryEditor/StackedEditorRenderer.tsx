import { css, cx } from '@emotion/css';
import { type RefObject, useCallback, useEffect, useMemo, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { Button, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';

import { QueryEditorType } from '../constants';

import {
  type StackedEditorItem,
  useActionsContext,
  useDatasourceContext,
  usePanelContext,
  useQueryEditorTypeConfig,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from './QueryEditorContext';
import { QueryEditorPanel } from './QueryEditorRenderer';
import { TransformationEditorPanel } from './TransformationEditorRenderer';
import { useQueryDatasource } from './hooks/useQueryDatasource';
import { type Transformation } from './types';
import { getEditorType } from './utils';

type StackedItem =
  | {
      type: QueryEditorType.Query | QueryEditorType.Expression;
      id: string;
      query: DataQuery;
    }
  | {
      type: QueryEditorType.Transformation;
      id: string;
      transformation: Transformation;
    };

function getStackedItemKey(item: StackedEditorItem) {
  return `${item.type}:${item.id}`;
}

function getStackedEditorItemType(type: string | null): StackedEditorItem['type'] | null {
  switch (type) {
    case QueryEditorType.Query:
    case QueryEditorType.Expression:
    case QueryEditorType.Transformation:
      return type;
    default:
      return null;
  }
}

function getStackedQueryEditorType(query: DataQuery): QueryEditorType.Query | QueryEditorType.Expression {
  return getEditorType(query) === QueryEditorType.Expression ? QueryEditorType.Expression : QueryEditorType.Query;
}

function isCurrentStackedItem({
  item,
  selectedQueryRefId,
  selectedTransformationId,
}: {
  item: StackedItem;
  selectedQueryRefId?: string;
  selectedTransformationId?: string;
}) {
  return item.type === QueryEditorType.Transformation
    ? item.id === selectedTransformationId
    : item.id === selectedQueryRefId;
}

function useActiveStackedItemObserver({
  containerRef,
  items,
  onActiveItemChange,
  scrollTarget,
  clearScrollTarget,
}: {
  containerRef: RefObject<HTMLDivElement>;
  items: StackedItem[];
  onActiveItemChange: (item: StackedEditorItem) => void;
  scrollTarget: StackedEditorItem | null;
  clearScrollTarget: () => void;
}) {
  const activeKeyRef = useRef<string | null>(null);
  const visibleItemsRef = useRef(new Map<string, { item: StackedEditorItem; ratio: number; top: number }>());

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const visibleItems = visibleItemsRef.current;
    visibleItems.clear();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target;
          const type = getStackedEditorItemType(element.getAttribute('data-stacked-editor-item-type'));
          const id = element.getAttribute('data-stacked-editor-item-id');

          if (!type || !id) {
            continue;
          }

          const item = { type, id };
          const key = getStackedItemKey(item);

          if (entry.isIntersecting && entry.intersectionRatio > 0) {
            visibleItems.set(key, {
              item,
              ratio: entry.intersectionRatio,
              top: entry.boundingClientRect.top,
            });
          } else {
            visibleItems.delete(key);
          }
        }

        const nextActive = Array.from(visibleItems.entries()).sort(([, a], [, b]) => {
          if (b.ratio !== a.ratio) {
            return b.ratio - a.ratio;
          }
          return a.top - b.top;
        })[0];

        if (!nextActive) {
          return;
        }

        if (scrollTarget) {
          const targetKey = getStackedItemKey(scrollTarget);
          if (nextActive[0] !== targetKey) {
            return;
          }
          clearScrollTarget();
        }

        const [key, { item }] = nextActive;
        if (activeKeyRef.current !== key) {
          activeKeyRef.current = key;
          onActiveItemChange(item);
        }
      },
      {
        root: container,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    const observedItems = container.querySelectorAll<HTMLElement>('[data-stacked-editor-item-id]');
    observedItems.forEach((item) => observer.observe(item));

    return () => {
      visibleItems.clear();
      observer.disconnect();
    };
  }, [clearScrollTarget, containerRef, items, onActiveItemChange, scrollTarget]);
}

function StackedQueryItem({ query }: { query: DataQuery }) {
  const styles = useStyles2(getStyles);
  const typeConfig = useQueryEditorTypeConfig();
  const { dsSettings } = useDatasourceContext();
  const { queries, data } = useQueryRunnerContext();
  const { updateSelectedQuery, addQuery, runQueries } = useActionsContext();
  const { queryDsData, queryDsLoading } = useQueryDatasource(query, dsSettings);
  const editorType = getStackedQueryEditorType(query);
  const typeLabel =
    editorType === QueryEditorType.Expression ? typeConfig[editorType].getLabel() : queryDsData?.dsSettings.name;

  return (
    <>
      <div className={styles.itemHeader}>
        <span className={styles.headerIcon}>
          {editorType === QueryEditorType.Query ? (
            <DataSourceLogo dataSource={queryDsData?.dsSettings} size={18} />
          ) : (
            <Icon name={typeConfig[editorType].icon} size="md" color={typeConfig[editorType].color} />
          )}
        </span>
        {typeLabel && (
          <>
            <span className={styles.headerLabel}>{typeLabel}</span>
            <span className={styles.headerSeparator} />
          </>
        )}
        <span className={styles.headerRefId}>{query.refId}</span>
      </div>
      <div className={styles.itemBody}>
        <QueryEditorPanel
          query={query}
          queryDsData={queryDsData}
          queryDsLoading={queryDsLoading}
          queries={queries}
          data={data}
          updateQuery={updateSelectedQuery}
          addQuery={addQuery}
          runQueries={runQueries}
        />
      </div>
    </>
  );
}

function StackedTransformationItem({ transformation }: { transformation: Transformation }) {
  const styles = useStyles2(getStyles);
  const typeConfig = useQueryEditorTypeConfig();
  const { transformations } = usePanelContext();
  const { data } = useQueryRunnerContext();
  const { updateTransformation } = useActionsContext();
  const transformationName = transformation.registryItem?.name || transformation.transformConfig.id;

  return (
    <>
      <div className={styles.itemHeader}>
        <span className={styles.headerIcon}>
          <Icon
            name={typeConfig[QueryEditorType.Transformation].icon}
            size="md"
            color={typeConfig[QueryEditorType.Transformation].color}
          />
        </span>
        <span className={styles.headerLabel}>
          <Trans i18nKey="query-editor-next.stacked.transformation">Transformation</Trans>
        </span>
        <span className={styles.headerSeparator} />
        <span className={styles.headerRefId}>{transformationName}</span>
      </div>
      <div className={styles.itemBody}>
        <TransformationEditorPanel
          transformation={transformation}
          transformations={transformations}
          data={data}
          updateTransformation={updateTransformation}
        />
      </div>
    </>
  );
}

export function StackedEditorRenderer() {
  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const { queries } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const { selectedQuery, selectedTransformation, stackedMode } = useQueryEditorUIContext();

  const items = useMemo<StackedItem[]>(
    () => [
      ...queries.map((query) => ({
        type: getStackedQueryEditorType(query),
        id: query.refId,
        query,
      })),
      ...transformations.map((transformation) => ({
        type: QueryEditorType.Transformation as const,
        id: transformation.transformId,
        transformation,
      })),
    ],
    [queries, transformations]
  );

  const { scrollTarget, clearScrollTarget } = stackedMode;

  useActiveStackedItemObserver({
    containerRef,
    items,
    onActiveItemChange: stackedMode.syncActiveItem,
    scrollTarget,
    clearScrollTarget,
  });

  useEffect(() => {
    if (!scrollTarget) {
      return;
    }

    const target = itemRefs.current.get(getStackedItemKey(scrollTarget));
    target?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [scrollTarget]);

  const setItemRef = useCallback((item: StackedEditorItem, element: HTMLElement | null) => {
    const key = getStackedItemKey(item);
    if (element) {
      itemRefs.current.set(key, element);
    } else {
      itemRefs.current.delete(key);
    }
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <Stack gap={1} alignItems="center">
          <Icon name="layer-group" size="md" />
          <Text variant="body" color="primary" weight="medium">
            {t('query-editor-next.stacked.showing-items', 'Showing {{count}} items', { count: items.length })}
          </Text>
        </Stack>
        <Button
          variant="secondary"
          fill="text"
          size="sm"
          icon="times"
          onClick={stackedMode.exit}
          aria-label={t('query-editor-next.stacked.exit-aria-label', 'Exit stacked view')}
        >
          <Trans i18nKey="query-editor-next.stacked.exit">Exit stacked view</Trans>
        </Button>
      </div>
      <div className={styles.scrollArea} ref={containerRef}>
        {items.map((item) => {
          const isCurrent = isCurrentStackedItem({
            item,
            selectedQueryRefId: selectedQuery?.refId,
            selectedTransformationId: selectedTransformation?.transformId,
          });

          return (
            <section
              key={getStackedItemKey(item)}
              ref={(element) => setItemRef(item, element)}
              className={cx(
                styles.item,
                isCurrent && item.type === QueryEditorType.Query && styles.currentQueryItem,
                isCurrent && item.type === QueryEditorType.Expression && styles.currentExpressionItem,
                isCurrent && item.type === QueryEditorType.Transformation && styles.currentTransformationItem
              )}
              aria-current={isCurrent ? 'true' : undefined}
              data-stacked-editor-item-id={item.id}
              data-stacked-editor-item-type={item.type}
            >
              {item.type === QueryEditorType.Transformation ? (
                <StackedTransformationItem transformation={item.transformation} />
              ) : (
                <StackedQueryItem query={item.query} />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

const getCurrentItemStyles = (theme: GrafanaTheme2, color: string) =>
  css({
    '&::before': {
      background: color,
    },
  });

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
  }),
  topBar: css({
    minHeight: theme.spacing(5),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1.5),
    backgroundColor: theme.colors.background.secondary,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  scrollArea: css({
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: theme.spacing(2),
    scrollPaddingTop: theme.spacing(2),
  }),
  item: css({
    position: 'relative',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    overflow: 'hidden',
    marginBottom: theme.spacing(1.5),
    '&::before': {
      content: '""',
      position: 'absolute',
      bottom: 0,
      left: 0,
      top: 0,
      width: 2,
      zIndex: 1,
    },
  }),
  currentQueryItem: getCurrentItemStyles(theme, theme.colors.warning.main),
  currentExpressionItem: getCurrentItemStyles(theme, theme.colors.tertiary.main),
  currentTransformationItem: getCurrentItemStyles(theme, theme.colors.success.main),
  itemHeader: css({
    minHeight: theme.spacing(5),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    padding: theme.spacing(0.5, 2),
    background: theme.colors.background.secondary,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  headerIcon: css({
    alignItems: 'center',
    display: 'inline-flex',
    flex: '0 0 auto',
    justifyContent: 'center',
    width: 18,
  }),
  headerLabel: css({
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightMedium,
    minWidth: 0,
  }),
  headerRefId: css({
    ...theme.typography.bodySmall,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  itemBody: css({
    padding: theme.spacing(2),
  }),
  headerSeparator: css({
    width: 1,
    height: theme.spacing(3),
    background: theme.colors.border.medium,
  }),
});

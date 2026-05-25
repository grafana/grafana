import { css } from '@emotion/css';
import { useId, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { QueryEditorType } from '../../constants';
import { usePanelContext, useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';

import { StackedSection } from './StackedSection';
import { useStackedItemScroll } from './useStackedItemScroll';
import { getStackedItemKey, getStackedQueryEditorType, isCurrentStackedItem, type StackedItem } from './utils';

export function StackedEditorRenderer() {
  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement>(null);
  const headingIdPrefix = useId();

  const { queries } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const { selectedQuery, selectedTransformation, stackedMode } = useQueryEditorUIContext();

  const items: StackedItem[] = [
    ...queries.map((query): StackedItem => ({ type: getStackedQueryEditorType(query), id: query.refId, query })),
    ...transformations.map(
      (transformation): StackedItem => ({
        type: QueryEditorType.Transformation,
        id: transformation.transformId,
        transformation,
      })
    ),
  ];

  // Wires the renderer into stacked-mode: registers an imperative scrollToItem with the wrapper
  // (so sidebar clicks can scroll the right section into view) and sets up the IntersectionObserver
  // that calls syncActiveItem as the user scrolls. No return value — all side effects.
  useStackedItemScroll({
    containerRef,
    items,
    onActiveItemChange: stackedMode.syncActiveItem,
    setScrollHandler: stackedMode.setScrollHandler,
  });

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
      <div
        className={styles.scrollArea}
        ref={containerRef}
        role="region"
        aria-label={t('query-editor-next.stacked.scroll-area-aria-label', 'Stacked editor items')}
      >
        {items.map((item) => {
          const key = getStackedItemKey(item);
          return (
            <StackedSection
              key={key}
              item={item}
              isCurrent={isCurrentStackedItem({
                item,
                selectedQueryRefId: selectedQuery?.refId,
                selectedTransformationId: selectedTransformation?.transformId,
              })}
              headingId={`${headingIdPrefix}-${key}`}
            />
          );
        })}
      </div>
    </div>
  );
}

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
    padding: theme.spacing(0.5, 2),
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
});

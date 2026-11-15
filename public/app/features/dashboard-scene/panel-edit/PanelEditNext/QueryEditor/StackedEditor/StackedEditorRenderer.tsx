import { css } from '@emotion/css';
import { Fragment, useId, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { QueryEditorType } from '../../constants';
import { DatasourceErrorAlert } from '../DatasourceErrorAlert';
import { usePanelContext, useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';
import { QueryOptionsOverlay } from '../QueryOptionsOverlay';

import { StackedAddBar } from './StackedAddBar';
import { StackedSection } from './StackedSection';
import { getStackedLayoutStyles } from './styles';
import { useStackedItemScroll } from './useStackedItemScroll';
import {
  getSelectedStackedItem,
  getStackedItemKey,
  getStackedQueryEditorType,
  isCurrentStackedItem,
  type StackedItem,
} from './utils';

export function StackedEditorRenderer() {
  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
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

  // The selected card, in the identity-only shape the scroll machinery speaks.
  const selectedItem = getSelectedStackedItem(selectedQuery, selectedTransformation);

  // Keeps the selected card and the scroll position in sync: pins the selected card to the top
  // (re-pinning as async editors load), and syncs selection back as the user scrolls. All side
  // effects — no return value.
  useStackedItemScroll({
    containerRef,
    contentRef,
    items,
    selectedItem,
    onActiveItemChange: stackedMode.syncActiveItem,
  });

  return (
    <div className={styles.container}>
      <div className={styles.errorAlert}>
        <DatasourceErrorAlert />
      </div>

      <QueryOptionsOverlay>
        <div
          className={styles.scrollArea}
          ref={containerRef}
          role="region"
          aria-label={t('query-editor-next.stacked.scroll-area-aria-label', 'Stacked editor items')}
        >
          {/* Wrapper exists so a ResizeObserver can watch the content height (not the fixed viewport)
              and re-pin the target as async editors finish loading. */}
          <div ref={contentRef}>
            {items.map((item) => {
              const key = getStackedItemKey(item);
              return (
                <Fragment key={key}>
                  <StackedSection
                    item={item}
                    isCurrent={isCurrentStackedItem({
                      item,
                      selectedQueryRefId: selectedQuery?.refId,
                      selectedTransformationId: selectedTransformation?.transformId,
                    })}
                    headingId={`${headingIdPrefix}-${key}`}
                  />
                  <StackedAddBar
                    variant={item.type === QueryEditorType.Transformation ? 'transformation' : 'query'}
                    afterId={item.id}
                  />
                </Fragment>
              );
            })}
          </div>
        </div>
      </QueryOptionsOverlay>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  ...getStackedLayoutStyles(),
  scrollArea: css({
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: theme.spacing(2),
    scrollPaddingTop: theme.spacing(2),
  }),
});

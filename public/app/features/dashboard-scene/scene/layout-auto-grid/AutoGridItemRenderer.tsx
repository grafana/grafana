import { css, cx } from '@emotion/css';
import { memo, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data/';
import { LazyLoader, SceneComponentProps, VizPanel } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { useIsConditionallyHidden } from '../../conditional-rendering/useIsConditionallyHidden';
import { useDashboardState } from '../../utils/utils';
import { renderMatchingSoloPanels, useSoloPanelContext } from '../SoloPanelContext';
import { getIsLazy } from '../layouts-shared/utils';

import { AutoGridItem } from './AutoGridItem';
import { DRAGGED_ITEM_HEIGHT, DRAGGED_ITEM_LEFT, DRAGGED_ITEM_TOP, DRAGGED_ITEM_WIDTH } from './const';

export function AutoGridItemRenderer({ model }: SceneComponentProps<AutoGridItem>) {
  const { body, repeatedPanels = [], key } = model.useState();
  const { draggingKey } = model.getParentGrid().useState();
  const { isEditing, preload } = useDashboardState(model);
  const [isConditionallyHidden, conditionalRenderingClass, conditionalRenderingOverlay] =
    useIsConditionallyHidden(model);
  const styles = useStyles2(getStyles);
  const soloPanelContext = useSoloPanelContext();
  const isLazy = useMemo(() => getIsLazy(preload), [preload]);

  const Wrapper = useMemo(
    () =>
      // eslint-disable-next-line react/display-name
      memo(
        ({
          item,
          addDndContainer,
          isDragged,
          isDragging,
          isRepeat = false,
        }: {
          item: VizPanel;
          addDndContainer: boolean;
          isDragged: boolean;
          isDragging: boolean;
          isRepeat?: boolean;
        }) => (
          <div
            {...(addDndContainer
              ? { ref: model.containerRef, ['data-auto-grid-item-drop-target']: isDragging ? key : undefined }
              : {})}
          >
            {isDragged && <div className={styles.draggedPlaceholder} />}
            {isLazy ? (
              <LazyLoader
                key={item.state.key!}
                className={cx(
                  conditionalRenderingClass,
                  styles.wrapper,
                  isDragged && !isRepeat && styles.draggedWrapper,
                  isDragged && isRepeat && styles.draggedRepeatWrapper
                )}
              >
                <item.Component model={item} />
                {conditionalRenderingOverlay}
              </LazyLoader>
            ) : (
              <div
                className={cx(
                  conditionalRenderingClass,
                  styles.wrapper,
                  isDragged && !isRepeat && styles.draggedWrapper,
                  isDragged && isRepeat && styles.draggedRepeatWrapper
                )}
              >
                <item.Component model={item} />
                {conditionalRenderingOverlay}
              </div>
            )}
          </div>
        )
      ),
    [conditionalRenderingClass, conditionalRenderingOverlay, isLazy, key, model.containerRef, styles]
  );

  if (soloPanelContext) {
    return renderMatchingSoloPanels(soloPanelContext, [body, ...repeatedPanels]);
  }

  if (isConditionallyHidden && !isEditing) {
    return null;
  }

  const isDragging = !!draggingKey;
  const isDragged = draggingKey === key;

  return (
    <>
      <Wrapper item={body} addDndContainer={true} key={body.state.key!} isDragged={isDragged} isDragging={isDragging} />
      {repeatedPanels.map((item) => (
        <Wrapper
          item={item}
          addDndContainer={false}
          key={item.state.key!}
          isDragged={isDragged}
          isDragging={isDragging}
          isRepeat={true}
        />
      ))}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({ width: '100%', height: '100%', position: 'relative' }),
  draggedWrapper: css({
    position: 'absolute',
    zIndex: 1000,
    top: `var(${DRAGGED_ITEM_TOP})`,
    left: `var(${DRAGGED_ITEM_LEFT})`,
    width: `var(${DRAGGED_ITEM_WIDTH})`,
    height: `var(${DRAGGED_ITEM_HEIGHT})`,
    opacity: 0.8,
  }),
  draggedRepeatWrapper: css({
    visibility: 'hidden',
  }),
  draggedPlaceholder: css({
    width: '100%',
    height: '100%',
    boxShadow: `0 0 ${theme.spacing(0.5)} ${theme.colors.primary.border}`,
    background: `${theme.colors.primary.transparent}`,
    zIndex: -1,
  }),
});

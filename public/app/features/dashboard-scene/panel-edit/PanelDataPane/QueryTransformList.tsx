import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { HTMLAttributes, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, ScrollContainer, Stack, useStyles2 } from '@grafana/ui';
import { ExpressionQueryType } from 'app/features/expressions/types';

import { AddDataItemMenu } from './AddDataItemMenu';
import { AiModeCard } from './AiModeCard';
import { ConnectionLines } from './ConnectionLines';
import { SidebarSize } from './PanelDataSidebar';
import { QueryTransformCard } from './QueryTransformCard';
import { getItemHiddenState, restoreItemStates, syncItemsToDebugState } from './debugModeHelpers';
import { usePanelDataPaneColors } from './theme';
import { QueryItem, QueryTransformItem, TransformItem } from './types';
import { useDebugMode } from './useDebugMode';

const CARD_HEIGHT = 70;

interface QueryTransformListProps {
  allItems: QueryTransformItem[];
  dataSourceItems: QueryItem[];
  sidebarSize: SidebarSize;
  transformItems: TransformItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddQuery: (index?: number) => void;
  onAddFromSavedQueries: (index?: number) => void;
  onAddTransform: (index?: number) => void;
  onAddExpression: (type: ExpressionQueryType, index?: number) => void;
  onDuplicateQuery?: (index: number) => void;
  onRemoveQuery?: (index: number) => void;
  onToggleQueryVisibility?: (index: number) => void;
  onRemoveTransform?: (index: number) => void;
  onToggleTransformVisibility?: (index: number) => void;
  onReorderDataSources?: (startIndex: number, endIndex: number) => void;
  onReorderTransforms?: (startIndex: number, endIndex: number) => void;
  onAddOrganizeFieldsTransform?: () => void;
  onResizeSidebar: (size: SidebarSize) => void;
  onCollapseSidebar: () => void;
  onDebugStateChange?: (isDebugMode: boolean, debugPosition: number) => void;
}

export const QueryTransformList = memo(
  ({
    dataSourceItems,
    transformItems,
    allItems,
    selectedId,
    sidebarSize,
    onSelect,
    onAddQuery,
    onAddFromSavedQueries,
    onAddTransform,
    onAddExpression,
    onDuplicateQuery,
    onRemoveQuery,
    onToggleQueryVisibility,
    onRemoveTransform,
    onToggleTransformVisibility,
    onReorderDataSources,
    onReorderTransforms,
    onAddOrganizeFieldsTransform,
    onResizeSidebar,
    onCollapseSidebar,
    onDebugStateChange,
  }: QueryTransformListProps) => {
    const colors = usePanelDataPaneColors();
    const styles = useStyles2(getStyles, colors);

    const [isDragging, setIsDragging] = useState(false);
    const [isAiMode, setIsAiMode] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
    const [hovered, setHovered] = useState<string | null>(null);
    const [viewingConnections, setViewingConnections] = useState<boolean>(false);
    const [collapsed, setCollapsed] = useState({ queries: false, transforms: false });

    // Debug mode via custom hook
    const handleDebugPositionChange = useCallback(
      (newPosition: number) => {
        // Select the card directly above the debug line (last enabled card)
        const cardToSelect = allItems[newPosition - 1];
        if (cardToSelect) {
          onSelect(cardToSelect.id);
        }
      },
      [allItems, onSelect]
    );

    const {
      debugPosition,
      setDebugPosition,
      dragOffset,
      handleDebugLineMouseDown,
      isDebugMode,
      isDraggingDebugLine,
      isItemHiddenByDebug,
      toggleDebugMode,
    } = useDebugMode(allItems, handleDebugPositionChange);

    // Store original states for restoration
    const originalStatesRef = useRef<Map<string, boolean>>(new Map());

    // Capture current states before entering debug mode
    const saveCurrentStates = useCallback(() => {
      const states = new Map<string, boolean>();
      allItems.forEach((item) => {
        const isHidden = getItemHiddenState(item);
        states.set(item.id, isHidden);
      });
      originalStatesRef.current = states;
    }, [allItems]);

    // Update actual states to match debug position
    const syncStatesToDebugPosition = useCallback(() => {
      syncItemsToDebugState(allItems, isItemHiddenByDebug, onToggleQueryVisibility, onToggleTransformVisibility);
    }, [allItems, isItemHiddenByDebug, onToggleQueryVisibility, onToggleTransformVisibility]);

    // Revert to original states
    const restoreOriginalStates = useCallback(() => {
      restoreItemStates(allItems, originalStatesRef.current, onToggleQueryVisibility, onToggleTransformVisibility);
      originalStatesRef.current = new Map(); // Clear after restoring
    }, [allItems, onToggleQueryVisibility, onToggleTransformVisibility]);

    // Handle state management
    const handleToggleDebug = useCallback(() => {
      if (!isDebugMode) {
        // Save then sync
        saveCurrentStates();
        toggleDebugMode();
      } else {
        // Restore states
        restoreOriginalStates();
        toggleDebugMode();
      }
    }, [isDebugMode, saveCurrentStates, toggleDebugMode, restoreOriginalStates]);

    // Sync when debug position changes
    const prevDebugPosition = useRef(debugPosition);
    useEffect(() => {
      if (isDebugMode && prevDebugPosition.current !== debugPosition) {
        syncStatesToDebugPosition();
      }
      prevDebugPosition.current = debugPosition;
    }, [isDebugMode, debugPosition, syncStatesToDebugPosition]);

    // Notify parent of debug state changes
    useEffect(() => {
      onDebugStateChange?.(isDebugMode, debugPosition);
    }, [isDebugMode, debugPosition, onDebugStateChange]);

    const onDragStart = () => {
      setIsDragging(true);
    };

    const onDragEnd = (result: DropResult) => {
      setIsDragging(false);

      if (!result.destination) {
        return;
      }

      const startIndex = result.source.index;
      const endIndex = result.destination.index;

      if (startIndex === endIndex) {
        return;
      }

      // Handle reordering based on droppable ID
      if (result.source.droppableId === 'data-sources' && result.destination.droppableId === 'data-sources') {
        onReorderDataSources?.(startIndex, endIndex);
      } else if (
        result.source.droppableId === 'transformations' &&
        result.destination.droppableId === 'transformations'
      ) {
        onReorderTransforms?.(startIndex, endIndex);
      }
    };

    const allConnections = useMemo(() => {
      const conns: Array<{ from: string; to: string }> = [];

      allItems.forEach((item) => {
        if (item.type === 'expression') {
          const expr = item.data;

          if ('expression' in expr && typeof expr.expression === 'string' && 'type' in expr) {
            const expressionType = expr.type;
            const expressionString = expr.expression;

            if (expressionType === 'math') {
              const matches = expressionString.matchAll(/\$(\w+)/g);
              for (const match of matches) {
                conns.push({ from: match[1], to: expr.refId });
              }
            } else if (expressionType === 'reduce' || expressionType === 'resample' || expressionType === 'threshold') {
              if (expressionString) {
                conns.push({ from: expressionString, to: expr.refId });
              }
            }
          }
        }
      });

      return conns;
    }, [allItems]);

    const activeItem = useMemo(
      () => (selectedId ? allItems.find((item) => item.id === selectedId) : undefined),
      [allItems, selectedId]
    );

    // Filter connections to only show for selected card
    const visibleConnections = useMemo(() => {
      if (activeItem?.type !== 'query' && activeItem?.type !== 'expression') {
        return [];
      }

      const activeRefId = activeItem.data.refId;

      // Show connections where this card is involved (either as source or destination)
      return allConnections.filter((conn) => conn.from === activeRefId || conn.to === activeRefId);
    }, [activeItem, allConnections]);

    const getHandlers = (item: QueryTransformItem) => {
      switch (item.type) {
        case 'expression':
        case 'query':
          return {
            onDuplicate: onDuplicateQuery ? () => onDuplicateQuery(item.index) : undefined,
            onRemove: onRemoveQuery ? () => onRemoveQuery(item.index) : undefined,
            onToggleVisibility: onToggleQueryVisibility ? () => onToggleQueryVisibility(item.index) : undefined,
          };
        case 'transform':
          return {
            onDuplicate: undefined,
            onRemove: onRemoveTransform ? () => onRemoveTransform(item.index) : undefined,
            onToggleVisibility: onToggleTransformVisibility ? () => onToggleTransformVisibility(item.index) : undefined,
          };
      }
    };

    const stats = useMemo(() => {
      const totalCards = allItems.length;
      const hiddenQueries = dataSourceItems.filter((item) => 'hide' in item.data && item.data.hide);
      const disabledTransforms = transformItems.filter((item) => 'disabled' in item.data && item.data.disabled);
      const hiddenTotal = hiddenQueries.length + disabledTransforms.length;
      const visibleTotal = totalCards - hiddenTotal;

      return {
        totalCards,
        visibleQueries: visibleTotal,
        hiddenQueries: hiddenTotal,
      };
    }, [allItems, dataSourceItems, transformItems]);

    const handleCardClick = (id: string) => {
      if (isAiMode) {
        // Toggle context selection in AI mode
        setSelectedContextIds((prev) => (prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]));
      } else {
        // Normal selection behavior
        onSelect(id);
      }
    };

    const selectedContexts = useMemo(() => {
      return selectedContextIds
        .map((id) => {
          const item = allItems.find((i) => i.id === id);
          if (!item) {
            return null;
          }

          let label = '';
          if ((item.type === 'query' || item.type === 'expression') && 'refId' in item.data) {
            label = item.data.refId || `${item.type === 'expression' ? 'Expression' : 'Query'} ${item.index + 1}`;
          } else if ('id' in item.data) {
            label = item.data.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
          }

          const icon: 'database' | 'code' | 'pivot' =
            item.type === 'query' ? 'database' : item.type === 'expression' ? 'code' : 'pivot';

          return {
            id,
            label,
            type: item.type,
            icon,
          };
        })
        .filter((c) => c !== null);
    }, [selectedContextIds, allItems]);

    const handleRemoveContext = (id: string) => {
      setSelectedContextIds((prev) => prev.filter((cid) => cid !== id));
    };

    const handleAiSubmit = (prompt: string) => {
      // TODO: Implement AI prompt submission
      console.log('AI Prompt:', prompt);
      console.log('Selected contexts:', selectedContexts);
    };

    const handleToggleAiMode = () => {
      if (isAiMode) {
        // Trigger closing animation
        setIsClosing(true);
        // Wait for animation to complete before actually closing
        setTimeout(() => {
          setIsAiMode(false);
          setIsClosing(false);
          setSelectedContextIds([]);
        }, 300); // Match animation duration
      } else {
        setIsAiMode(true);
      }
    };

    const filteredDataSourceItems = useMemo(() => {
      if (!viewingConnections) {
        return dataSourceItems;
      }
      const visibleConnectionsRefIds = new Set<string>();
      for (const conn of visibleConnections) {
        visibleConnectionsRefIds.add(conn.from);
        visibleConnectionsRefIds.add(conn.to);
      }
      return dataSourceItems.filter((item) => visibleConnectionsRefIds.has(item.data.refId));
    }, [dataSourceItems, viewingConnections, visibleConnections]);

    const canAdd = !isDragging && !viewingConnections;

    const cardListHoverHandlerFactory = useCallback(
      (itemList: QueryTransformItem[], lastItemId: string): HTMLAttributes<HTMLDivElement>['onMouseMove'] =>
        (ev) => {
          const rect = ev.currentTarget.getBoundingClientRect();
          const y = ev.clientY - rect.top;
          let hoveredIdx = Math.floor((y - 16 + CARD_HEIGHT / 2) / CARD_HEIGHT);
          if (hoveredIdx < 0) {
            hoveredIdx = 0;
          }
          if (hoveredIdx > itemList.length) {
            hoveredIdx = itemList.length;
          }
          const hoveredId = hoveredIdx === itemList.length ? lastItemId : itemList[hoveredIdx].id;
          setHovered(hoveredId);
        },
      []
    );

    return (
      <div className={styles.container} onMouseLeave={() => setHovered(null)}>
        <div className={styles.header}>
          <Stack justifyContent="space-between" alignItems="center" gap={2}>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div
              className={styles.headerTitle}
              onClick={() => onResizeSidebar(sidebarSize === SidebarSize.Mini ? SidebarSize.Full : SidebarSize.Mini)}
            >
              <Stack direction="row" alignItems="center" gap={1}>
                <Icon name={sidebarSize === SidebarSize.Mini ? 'expand-arrows' : 'compress-arrows'} />
                <span>{t('dashboard-scene.query-transform-list.header', 'Pipeline flow')}</span>
              </Stack>
            </div>
            <Stack direction="row" gap={0.5}>
              <Button
                variant="secondary"
                fill="text"
                size="sm"
                onClick={handleToggleDebug}
                className={cx(styles.debugButton, { [styles.debugButtonActive]: isDebugMode })}
                tooltip={
                  isDebugMode
                    ? t('dashboard-scene.query-transform-list.debug-mode-exit', 'Exit debug mode')
                    : t('dashboard-scene.query-transform-list.debug-mode-enter', 'Step through your pipeline')
                }
              >
                <Icon name="bug" size="sm" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleToggleAiMode}
                className={cx(isAiMode ? styles.aiModeButtonActive : styles.aiModeButtonInactive)}
                tooltip={
                  isAiMode
                    ? t('dashboard-scene.query-transform-list.ai-mode-exit', 'Exit AI mode')
                    : t('dashboard-scene.query-transform-list.ai-mode-enter', 'Supercharge your pipeline with AI')
                }
              >
                <Stack direction="row" gap={0.5} alignItems="center">
                  <Icon name="ai" size="sm" className={isAiMode ? undefined : styles.aiModeIcon} />
                  <span className={isAiMode ? undefined : styles.aiModeText}>
                    {t('dashboard-scene.query-transform-list.ai-mode', 'AI')}
                  </span>
                </Stack>
              </Button>
            </Stack>
          </Stack>
        </div>
        {isAiMode && (
          <div className={cx(styles.aiModeContent, isClosing && styles.aiModeClosing)}>
            <AiModeCard
              selectedContexts={selectedContexts}
              onRemoveContext={handleRemoveContext}
              onSubmit={handleAiSubmit}
              onDemoWorkflow={
                onAddOrganizeFieldsTransform
                  ? {
                      availableCardIds: allItems.map((item) => item.id),
                      onSelectContext: (id) => {
                        setSelectedContextIds((prev) => [...prev, id]);
                      },
                      onAddOrganizeFieldsTransformation: onAddOrganizeFieldsTransform,
                      onCloseAiMode: () => {
                        setIsClosing(true);
                        setTimeout(() => {
                          setIsAiMode(false);
                          setIsClosing(false);
                          setSelectedContextIds([]);
                        }, 300);
                      },
                    }
                  : undefined
              }
            />
          </div>
        )}
        <div className={styles.scrollWrapper} data-testid="query-transform-list-scroll-wrapper">
          <ScrollContainer data-scrollcontainer height="100%">
            <div className={styles.contentWrapper}>
              <ConnectionLines
                connections={visibleConnections}
                isDragging={isDragging}
                selected={viewingConnections}
                onClick={() => setViewingConnections((current) => !current)}
              />
              <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
                <div
                  className={cx(
                    styles.content,
                    isAiMode && !isClosing && styles.contentGradientBorder,
                    isClosing && styles.contentGradientBorderClosing
                  )}
                  data-testid="query-transform-list-content"
                >
                  <Stack direction="column" gap={2}>
                    {/* Data Sources Section (Queries + Expressions) */}
                    <Stack direction="column" gap={2}>
                      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
                      <div
                        className={styles.sectionLabel}
                        onClick={() => setCollapsed((c) => ({ ...c, queries: !c.queries }))}
                      >
                        <Icon name={collapsed.queries ? 'angle-right' : 'angle-down'} />
                        {t('dashboard-scene.query-transform-list.queries-expressions', 'Queries & Expressions')}
                      </div>
                      {!collapsed.queries &&
                        (dataSourceItems.length > 0 ? (
                          <Droppable droppableId="data-sources">
                            {(provided, snapshot) => {
                              // Check if dragging from transformations section
                              const isDraggingFromOtherSection =
                                isDragging && snapshot.draggingFromThisWith === null && snapshot.isDraggingOver;

                              return (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  onMouseMove={cardListHoverHandlerFactory(dataSourceItems, 'queries-last')}
                                  className={cx(
                                    styles.cardList,
                                    isDraggingFromOtherSection ? styles.droppableInvalid : undefined
                                  )}
                                >
                                  <Stack direction="column" gap={2}>
                                    {filteredDataSourceItems.map((item, idx) => {
                                      const globalIndex = allItems.findIndex((i) => i.id === item.id);
                                      const isDebugDisabled = isDebugMode && globalIndex >= debugPosition;
                                      const showDebugLineAfter = isDebugMode && globalIndex === debugPosition - 1;

                                      return (
                                        <>
                                          <div
                                            key={item.id}
                                            className={cx(styles.cardContainer, {
                                              [styles.cardDebugDisabled]: isDebugDisabled,
                                            })}
                                          >
                                            <Draggable
                                              isDragDisabled={viewingConnections || isDebugMode}
                                              draggableId={item.id}
                                              index={item.index}
                                            >
                                              {(provided, snapshot) => (
                                                <div
                                                  ref={provided.innerRef}
                                                  {...provided.draggableProps}
                                                  {...provided.dragHandleProps}
                                                  className={snapshot.isDragging ? styles.dragging : undefined}
                                                >
                                                  <QueryTransformCard
                                                    item={item}
                                                    isSelected={
                                                      isAiMode
                                                        ? selectedContextIds.includes(item.id)
                                                        : selectedId === item.id
                                                    }
                                                    onClick={() => handleCardClick(item.id)}
                                                    debugHiddenOverride={isItemHiddenByDebug(item.id)}
                                                    {...getHandlers(item)}
                                                  />
                                                </div>
                                              )}
                                            </Draggable>
                                            <div className={styles.addButtonFloating}>
                                              <AddDataItemMenu
                                                onAddQuery={onAddQuery}
                                                onAddTransform={onAddTransform}
                                                onAddExpression={onAddExpression}
                                                onAddFromSavedQueries={onAddFromSavedQueries}
                                                index={item.index}
                                                allowedTypes={['query', 'expression']}
                                                show={canAdd && hovered === item.id}
                                              />
                                            </div>
                                          </div>
                                          {showDebugLineAfter && (
                                            <div
                                              role="slider"
                                              aria-label={t(
                                                'dashboard-scene.query-transform-list.debug-position',
                                                'Debug position'
                                              )}
                                              aria-valuemin={1}
                                              aria-valuemax={allItems.length}
                                              aria-valuenow={debugPosition}
                                              tabIndex={0}
                                              className={cx(styles.debugLine, {
                                                [styles.debugLineDragging]: isDraggingDebugLine,
                                              })}
                                              style={{
                                                transform: isDraggingDebugLine
                                                  ? `translateY(${dragOffset}px)`
                                                  : undefined,
                                              }}
                                              onMouseDown={handleDebugLineMouseDown}
                                              onKeyDown={(e) => {
                                                if (e.key === 'ArrowUp') {
                                                  e.preventDefault();
                                                  const newPos = Math.max(1, debugPosition - 1);
                                                  setDebugPosition(newPos);
                                                  handleDebugPositionChange(newPos);
                                                } else if (e.key === 'ArrowDown') {
                                                  e.preventDefault();
                                                  const newPos = Math.min(allItems.length, debugPosition + 1);
                                                  setDebugPosition(newPos);
                                                  handleDebugPositionChange(newPos);
                                                }
                                              }}
                                            >
                                              <div className={styles.debugLineHandle}>
                                                <Icon name="draggabledots" size="sm" />
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      );
                                    })}
                                    {provided.placeholder}
                                  </Stack>

                                  <div className={cx(styles.cardContainer, styles.cardContainerLast)}>
                                    <div className={styles.addButtonFloating}>
                                      <AddDataItemMenu
                                        onAddQuery={onAddQuery}
                                        onAddFromSavedQueries={onAddFromSavedQueries}
                                        onAddTransform={onAddTransform}
                                        onAddExpression={onAddExpression}
                                        allowedTypes={['query', 'expression']}
                                        index={dataSourceItems.length}
                                        show={canAdd && hovered === 'queries-last'}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            }}
                          </Droppable>
                        ) : (
                          <AddDataItemMenu
                            onAddQuery={onAddQuery}
                            onAddFromSavedQueries={onAddFromSavedQueries}
                            onAddTransform={onAddTransform}
                            onAddExpression={onAddExpression}
                            allowedTypes={['query', 'expression']}
                            text={t('dashboard-scene.query-transform-list.add', 'Add')}
                          />
                        ))}
                    </Stack>

                    {/* Transformations Section */}
                    <Stack direction="column" gap={2}>
                      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
                      <div
                        className={styles.sectionLabel}
                        onClick={() => setCollapsed((c) => ({ ...c, transforms: !c.transforms }))}
                      >
                        <Icon name={collapsed.transforms ? 'angle-right' : 'angle-down'} />
                        {t('dashboard-scene.query-transform-list.transformations', 'Transformations')}
                      </div>
                      {!collapsed.transforms &&
                        (transformItems.length > 0 ? (
                          <Droppable droppableId="transformations">
                            {(provided, snapshot) => {
                              // Check if dragging from data sources section
                              const isDraggingFromOtherSection =
                                isDragging && snapshot.draggingFromThisWith === null && snapshot.isDraggingOver;

                              return (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={cx(
                                    styles.cardList,
                                    isDraggingFromOtherSection ? styles.droppableInvalid : undefined
                                  )}
                                  onMouseMove={cardListHoverHandlerFactory(transformItems, 'transformations-last')}
                                >
                                  <Stack direction="column" gap={2}>
                                    {transformItems.map((item) => {
                                      // Find this item's position in the global allItems array
                                      const globalIndex = allItems.findIndex((i) => i.id === item.id);
                                      const isDebugDisabled = isDebugMode && globalIndex >= debugPosition;
                                      const showDebugLineAfter = isDebugMode && globalIndex === debugPosition - 1;

                                      return (
                                        <>
                                          <div
                                            key={item.id}
                                            className={cx(styles.cardContainer, {
                                              [styles.cardDebugDisabled]: isDebugDisabled,
                                            })}
                                          >
                                            <Draggable
                                              key={item.id}
                                              draggableId={item.id}
                                              index={item.index}
                                              isDragDisabled={isDebugMode}
                                            >
                                              {(provided, snapshot) => (
                                                <div
                                                  ref={provided.innerRef}
                                                  {...provided.draggableProps}
                                                  {...provided.dragHandleProps}
                                                  className={snapshot.isDragging ? styles.dragging : undefined}
                                                >
                                                  <QueryTransformCard
                                                    item={item}
                                                    isSelected={
                                                      isAiMode
                                                        ? selectedContextIds.includes(item.id)
                                                        : selectedId === item.id
                                                    }
                                                    onClick={() => handleCardClick(item.id)}
                                                    debugHiddenOverride={isItemHiddenByDebug(item.id)}
                                                    {...getHandlers(item)}
                                                  />
                                                </div>
                                              )}
                                            </Draggable>
                                            <div className={styles.addButtonFloating}>
                                              <AddDataItemMenu
                                                onAddQuery={onAddQuery}
                                                onAddTransform={onAddTransform}
                                                onAddExpression={onAddExpression}
                                                onAddFromSavedQueries={onAddFromSavedQueries}
                                                index={item.index}
                                                allowedTypes={['transform']}
                                                show={canAdd && hovered === item.id}
                                              />
                                            </div>
                                          </div>
                                          {showDebugLineAfter && (
                                            <div
                                              role="slider"
                                              aria-label={t(
                                                'dashboard-scene.query-transform-list.debug-position',
                                                'Debug position'
                                              )}
                                              aria-valuemin={1}
                                              aria-valuemax={allItems.length}
                                              aria-valuenow={debugPosition}
                                              tabIndex={0}
                                              className={cx(styles.debugLine, {
                                                [styles.debugLineDragging]: isDraggingDebugLine,
                                              })}
                                              style={{
                                                transform: isDraggingDebugLine
                                                  ? `translateY(${dragOffset}px)`
                                                  : undefined,
                                              }}
                                              onMouseDown={handleDebugLineMouseDown}
                                              onKeyDown={(e) => {
                                                if (e.key === 'ArrowUp') {
                                                  e.preventDefault();
                                                  const newPos = Math.max(1, debugPosition - 1);
                                                  setDebugPosition(newPos);
                                                  handleDebugPositionChange(newPos);
                                                } else if (e.key === 'ArrowDown') {
                                                  e.preventDefault();
                                                  const newPos = Math.min(allItems.length, debugPosition + 1);
                                                  setDebugPosition(newPos);
                                                  handleDebugPositionChange(newPos);
                                                }
                                              }}
                                            >
                                              <div className={styles.debugLineHandle}>
                                                <Icon name="draggabledots" size="sm" />
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      );
                                    })}
                                    {provided.placeholder}
                                  </Stack>
                                  <div className={cx(styles.cardContainer, styles.cardContainerLast)}>
                                    <div className={styles.addButtonFloating}>
                                      <AddDataItemMenu
                                        onAddQuery={onAddQuery}
                                        onAddFromSavedQueries={onAddFromSavedQueries}
                                        onAddTransform={onAddTransform}
                                        onAddExpression={onAddExpression}
                                        allowedTypes={['transform']}
                                        index={transformItems.length}
                                        show={canAdd && hovered === 'transformations-last'}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            }}
                          </Droppable>
                        ) : (
                          <AddDataItemMenu
                            onAddQuery={onAddQuery}
                            onAddFromSavedQueries={onAddFromSavedQueries}
                            onAddTransform={onAddTransform}
                            onAddExpression={onAddExpression}
                            allowedTypes={['transform']}
                            index={0}
                            text={t('dashboard-scene.query-transform-list.add', 'Add')}
                          />
                        ))}
                    </Stack>
                  </Stack>
                </div>
              </DragDropContext>
            </div>
          </ScrollContainer>
        </div>
        <div className={styles.footer}>
          <Stack direction="row" gap={1.5}>
            <span className={styles.footerStat}>
              {stats.totalCards} {t('dashboard-scene.query-transform-list.nodes', 'nodes')}
            </span>
            <span className={styles.footerStat}>
              <Icon size="xs" name="eye" />
              {stats.visibleQueries}
            </span>
            <span className={styles.footerStat}>
              <Icon size="xs" name="eye-slash" />
              {stats.hiddenQueries}
            </span>
          </Stack>
        </div>
      </div>
    );
  }
);

QueryTransformList.displayName = 'QueryTransformList';

const getStyles = (theme: GrafanaTheme2, colors: ReturnType<typeof usePanelDataPaneColors>) => {
  const barBase = {
    padding: theme.spacing(0.5, 2),
    background: theme.colors.background.secondary,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  };

  return {
    container: css({
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      maxWidth: '100%',
      overflow: 'auto',
      border: `1px solid ${theme.colors.border.weak}`,
      borderLeft: 'none',
    }),
    header: css({
      ...barBase,
      height: theme.spacing(6),
      borderBottom: `1px solid ${theme.colors.border.weak}`,

      '& > div:first-child': {
        width: '100%',
      },
    }),
    headerTitle: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      textTransform: 'uppercase',
      color: theme.colors.text.primary,
      cursor: 'pointer',
    }),
    sectionLabel: css({
      cursor: 'pointer',
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.maxContrast,
      textTransform: 'uppercase',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      '&::after': {
        content: '""',
        flex: 1,
        height: '1px',
        background: theme.colors.border.weak,
      },
    }),
    scrollWrapper: css({
      flex: 1,
      minHeight: 0,
    }),
    contentWrapper: css({
      position: 'relative',
      minHeight: '100%',
    }),
    aiModeContent: css({
      padding: theme.spacing(1, 1),
      position: 'relative',
      zIndex: 15,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: 'slideDown 0.3s ease-out',
        '@keyframes slideDown': {
          from: {
            opacity: 0,
            transform: 'translateY(-20px)',
          },
          to: {
            opacity: 1,
            transform: 'translateY(0)',
          },
        },
      },
    }),
    aiModeClosing: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: 'slideUp 0.3s ease-in forwards',
        '@keyframes slideUp': {
          from: {
            opacity: 1,
            transform: 'translateY(0)',
          },
          to: {
            opacity: 0,
            transform: 'translateY(-20px)',
          },
        },
      },
    }),
    content: css({
      padding: theme.spacing(2, 6, 2, 2),
      position: 'relative',
    }),
    contentGradientBorder: css({
      borderTop: '2px solid transparent',
      borderImage: 'linear-gradient(90deg, #FF9830 0%, #B877D9 100%) 1',
      paddingTop: theme.spacing(3),
    }),
    contentGradientBorderClosing: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: 'fadeBorderOut 0.3s ease-in forwards',
        '@keyframes fadeBorderOut': {
          from: {
            borderTopColor: 'rgba(255, 152, 48, 1)',
            paddingTop: theme.spacing(3),
          },
          to: {
            borderTopColor: 'transparent',
            paddingTop: theme.spacing(2),
          },
        },
      },
    }),
    dragging: css({
      opacity: 0.8,
      cursor: 'grabbing !important',
      // Use GPU-accelerated properties only
      willChange: 'transform',
    }),
    droppableActive: css({
      // Minimal styling for performance
    }),
    droppableInvalid: css({
      position: 'relative',
      cursor: 'not-allowed',
      '&::after': {
        content: '""',
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        background: theme.colors.error.transparent,
        borderRadius: theme.shape.radius.default,
        pointerEvents: 'none',
        zIndex: 0,
      },
      '& > *': {
        position: 'relative',
        zIndex: 1,
      },
    }),
    footer: css({
      ...barBase,
      height: theme.spacing(4),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      gap: theme.spacing(1),
      position: 'relative',
      zIndex: 20,
    }),
    footerStat: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    cardList: css({
      paddingLeft: theme.spacing(4),
      marginLeft: theme.spacing(-2),
      position: 'relative',
    }),
    cardContainer: css({
      position: 'relative',
      overflowX: 'visible',
    }),
    cardContainerLast: css({
      marginTop: theme.spacing(2),
    }),
    cardDebugDisabled: css({
      opacity: 0.4,
      pointerEvents: 'none',
    }),
    addButtonFloating: css({
      position: 'absolute',
      top: theme.spacing(-2),
      left: theme.spacing(-2.5),
    }),
    aiModeButtonInactive: css({
      border: 'none',
      borderRadius: theme.shape.radius.default,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontWeight: theme.typography.fontWeightMedium,
      textTransform: 'uppercase',
      background: 'transparent',
    }),
    aiModeIcon: css({
      color: '#FF9830',
    }),
    aiModeText: css({
      background: 'linear-gradient(90deg, #FF9830 0%, #B877D9 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    }),
    aiModeButtonActive: css({
      background: 'linear-gradient(90deg, #FF9830 0%, #B877D9 100%)',
      WebkitBackgroundClip: 'initial',
      WebkitTextFillColor: 'initial',
      backgroundClip: 'initial',
      border: 'none',
      borderRadius: theme.shape.radius.default,
      color: '#ffffff',
      fontWeight: theme.typography.fontWeightMedium,
      fontFamily: theme.typography.fontFamilyMonospace,
      textTransform: 'uppercase',
      '&:hover': {
        background: 'linear-gradient(90deg, #FFB050 0%, #C88FE5 100%)',
        boxShadow: '0 4px 12px rgba(255, 152, 48, 0.4)',
      },
      '&:focus, &:active, &:focus:active': {
        background: 'linear-gradient(90deg, #FF9830 0%, #B877D9 100%)',
        boxShadow: '0 4px 12px rgba(255, 152, 48, 0.4)',
      },
    }),
    debugButton: css({
      border: 'none',
      borderRadius: theme.shape.radius.default,
      fontWeight: theme.typography.fontWeightMedium,
      fontFamily: theme.typography.fontFamilyMonospace,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }),
    debugButtonActive: css({
      '&:focus, &:active, &:focus:active': {
        background: '#441306',
      },
    }),
    debugLine: css({
      height: '4px',
      background: colors.query.accent,
      cursor: 'ns-resize',
      position: 'relative',
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      userSelect: 'none',
      [theme.transitions.handleMotion('no-preference')]: {
        transition: 'height 0.15s ease, transform 0.2s ease',
      },
      '&:hover': {
        height: '6px',
      },
    }),
    debugLineDragging: css({
      height: '6px',
      [theme.transitions.handleMotion('no-preference')]: {
        transition: 'height 0.15s ease',
      },
    }),
    debugLineHandle: css({
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      background: colors.query.accent,
      borderRadius: theme.shape.radius.circle,
      padding: theme.spacing(0.5),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.colors.text.primary,
      cursor: 'grab',
      '&:active': {
        cursor: 'grabbing',
      },
    }),
  };
};

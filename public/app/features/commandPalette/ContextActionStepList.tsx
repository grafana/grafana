import { css, cx } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type CommandPaletteContextStep, type ContextStepBreadcrumb, type ContextStepOption, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Checkbox, Icon, IconName, LoadingBar, useStyles2 } from '@grafana/ui';

export interface ContextActionStepState {
  currentStep: CommandPaletteContextStep;
  breadcrumbs: ContextStepBreadcrumb[];
  selectedOptions: ContextStepOption[];
}

interface ContextActionStepListProps {
  state: ContextActionStepState;
  onTransition: (next: ContextActionStepState | null) => void;
  onClose: () => void;
}

export function ContextActionStepList({ state, onTransition, onClose }: ContextActionStepListProps) {
  const styles = useStyles2(getStyles);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<ContextStepOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(state.selectedOptions.map((o) => o.id))
  );

  const historyRef = useRef<ContextActionStepState[]>([]);
  const rootStepRef = useRef(state.currentStep);

  const { currentStep, breadcrumbs } = state;
  const isDeferred = rootStepRef.current.applyMode === 'deferred';
  const isMultiSelect = Boolean(currentStep.multiSelect);

  useEffect(() => {
    inputRef.current?.focus();
  }, [currentStep]);

  useEffect(() => {
    setSearchQuery('');
    setActiveIndex(0);
    setSelectedIds(new Set(state.selectedOptions.map((o) => o.id)));
  }, [currentStep, state.selectedOptions]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setIsLoading(true);

    currentStep
      .getOptions(searchQuery, controller.signal, breadcrumbs)
      .then((result: ContextStepOption[]) => {
        if (!cancelled) {
          setOptions(result);
          setActiveIndex(0);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled && !(err instanceof DOMException && err.name === 'AbortError')) {
          setOptions([]);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentStep, searchQuery, breadcrumbs]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery) {
      return options;
    }
    const lower = searchQuery.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(lower) || o.description?.toLowerCase().includes(lower)
    );
  }, [options, searchQuery]);

  const groups = useMemo(() => {
    const groupMap = new Map<string, ContextStepOption[]>();
    for (const option of filteredOptions) {
      const key = option.group ?? '';
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(option);
    }
    return groupMap;
  }, [filteredOptions]);

  const flatItems = useMemo(() => {
    const items: Array<{ type: 'header'; label: string } | { type: 'option'; option: ContextStepOption }> = [];
    groups.forEach((groupOptions, groupKey) => {
      if (groupKey) {
        items.push({ type: 'header', label: groupKey });
      }
      for (const option of groupOptions) {
        items.push({ type: 'option', option });
      }
    });
    return items;
  }, [groups]);

  const selectableItems = useMemo(
    () => flatItems.filter((item): item is { type: 'option'; option: ContextStepOption } => item.type === 'option'),
    [flatItems]
  );

  const goBack = useCallback(
    (extraBreadcrumb?: ContextStepBreadcrumb, levels = 1) => {
      const history = historyRef.current;
      let targetState: ContextActionStepState | null = null;
      for (let i = 0; i < levels && history.length > 0; i++) {
        targetState = history.pop()!;
      }
      if (targetState) {
        const newBreadcrumbs = extraBreadcrumb
          ? [...targetState.breadcrumbs, extraBreadcrumb]
          : targetState.breadcrumbs;
        onTransition({ ...targetState, breadcrumbs: newBreadcrumbs });
      } else {
        onTransition(null);
      }
    },
    [onTransition]
  );

  const applyAndGoBack = useCallback(() => {
    if (isMultiSelect && selectedIds.size > 0) {
      const selected = options.filter((o) => selectedIds.has(o.id));
      if (!isDeferred && currentStep.onApply) {
        currentStep.onApply(selected, breadcrumbs);
      }
      const summary = selected.map((s) => s.id).join(',');
      const collapse = currentStep.collapseSteps || 0;

      if (collapse > 0 && currentStep.buildCollapsedBreadcrumb) {
        const collapsedBc = currentStep.buildCollapsedBreadcrumb(breadcrumbs, summary);
        goBack(collapsedBc, 1 + collapse);
      } else {
        const lastBc = breadcrumbs[breadcrumbs.length - 1];
        const displayLabel = lastBc?.label || currentStep.pillLabel;
        const internalKey = lastBc?.value || currentStep.pillLabel;
        goBack({ label: `${displayLabel}:${summary}`, value: `${internalKey}:${summary}` });
      }
    } else {
      goBack();
    }
  }, [isMultiSelect, selectedIds, options, isDeferred, currentStep, breadcrumbs, goBack]);

  const handleSelectOption = useCallback(
    (option: ContextStepOption) => {
      if (isMultiSelect) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(option.id)) {
            next.delete(option.id);
          } else {
            next.add(option.id);
          }
          return next;
        });
        return;
      }

      const transition = currentStep.onSelect(option, breadcrumbs);
      switch (transition.type) {
        case 'next':
          historyRef.current.push(state);
          onTransition({
            currentStep: transition.step,
            breadcrumbs: [...breadcrumbs, transition.breadcrumb],
            selectedOptions: [],
          });
          break;
        case 'apply':
          if (transition.close !== false) {
            onClose();
          }
          break;
        case 'callback':
          transition.fn();
          if (transition.close !== false) {
            onClose();
          }
          break;
        case 'goBack':
          goBack(transition.breadcrumb);
          break;
      }
    },
    [isMultiSelect, currentStep, breadcrumbs, state, onTransition, onClose, goBack]
  );

  const handleApply = useCallback(() => {
    if (isDeferred && rootStepRef.current.onCommit) {
      let finalBreadcrumbs = breadcrumbs;
      if (isMultiSelect && selectedIds.size > 0) {
        const selected = options.filter((o) => selectedIds.has(o.id));
        const filterKey = breadcrumbs[breadcrumbs.length - 1]?.value || currentStep.pillLabel;
        const summary = selected.map((s) => s.id).join(',');
        finalBreadcrumbs = [...breadcrumbs.slice(0, -1), { label: `${filterKey}:${summary}`, value: `${filterKey}:${summary}` }];
      }
      rootStepRef.current.onCommit(finalBreadcrumbs);
    } else if (isMultiSelect && selectedIds.size > 0 && currentStep.onApply) {
      const selected = options.filter((o) => selectedIds.has(o.id));
      currentStep.onApply(selected, breadcrumbs);
    }
    onClose();
  }, [isDeferred, isMultiSelect, selectedIds, options, currentStep, breadcrumbs, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();

      if (e.key === 'Escape') {
        e.preventDefault();
        e.nativeEvent.stopImmediatePropagation();
        applyAndGoBack();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleApply();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, selectableItems.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const item = selectableItems[activeIndex];
        if (item) {
          handleSelectOption(item.option);
        }
        return;
      }

      if (e.key === 'Backspace' && searchQuery === '' && breadcrumbs.length > 0) {
        e.preventDefault();
        const removed = breadcrumbs[breadcrumbs.length - 1];
        if (!isDeferred && rootStepRef.current.onRemoveBreadcrumb) {
          rootStepRef.current.onRemoveBreadcrumb(removed);
        }
        onTransition({ ...state, breadcrumbs: breadcrumbs.slice(0, -1) });
        return;
      }
    },
    [applyAndGoBack, handleApply, selectableItems, activeIndex, handleSelectOption, searchQuery, breadcrumbs, isDeferred, state, onTransition]
  );

  useEffect(() => {
    const container = listRef.current;
    if (!container) {
      return;
    }
    const activeEl = container.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (!activeEl) {
      return;
    }

    const prevSibling = activeEl.previousElementSibling;
    let scrollTarget: HTMLElement = activeEl;
    if (prevSibling instanceof HTMLElement && prevSibling.hasAttribute('data-group-header')) {
      scrollTarget = prevSibling;
    }

    const containerRect = container.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    const targetRect = scrollTarget.getBoundingClientRect();

    if (elRect.bottom > containerRect.bottom) {
      container.scrollTop += elRect.bottom - containerRect.bottom;
    } else if (targetRect.top < containerRect.top) {
      container.scrollTop -= containerRect.top - targetRect.top;
    }
  }, [activeIndex]);

  const selectedSummary = useMemo(() => {
    if (!isMultiSelect || selectedIds.size === 0) {
      return null;
    }
    const names = filteredOptions
      .filter((o) => selectedIds.has(o.id))
      .map((o) => o.label);
    return names.join(', ');
  }, [isMultiSelect, selectedIds, filteredOptions]);

  const handleBack = useCallback(() => {
    applyAndGoBack();
  }, [applyAndGoBack]);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div onKeyDown={handleKeyDown}>
      <div className={styles.inputContainer}>
        <button className={styles.backButton} onClick={handleBack} aria-label={t('command-palette.context-action.back', 'Back')} type="button">
          <Icon name="arrow-left" size="md" />
        </button>
        <div className={styles.breadcrumbs}>
          {rootStepRef.current.pillIcon && (
            <span className={styles.pill}>
              {/* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */}
              <Icon name={rootStepRef.current.pillIcon as IconName} size="sm" />
              <span>{rootStepRef.current.pillLabel}</span>
            </span>
          )}
          {!rootStepRef.current.pillIcon && (
            <span className={styles.pill}>{rootStepRef.current.pillLabel}</span>
          )}
          {breadcrumbs.map((bc, i) => (
            <React.Fragment key={i}>
              <span className={styles.separator}>/</span>
              <span className={styles.pill}>{bc.label}</span>
            </React.Fragment>
          ))}
          {selectedSummary && (
            <>
              <span className={styles.separator}>:</span>
              <span className={styles.selectedSummary}>{selectedSummary}</span>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          className={styles.input}
          placeholder={currentStep.placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className={styles.loadingBarContainer}>
        {isLoading && <LoadingBar width={500} delay={0} />}
      </div>
      <div className={currentStep.helpPanel ? styles.splitContainer : undefined}>
        <div ref={listRef} className={cx(styles.list, currentStep.helpPanel && styles.listWithPanel)} role="listbox">
          {flatItems.length === 0 && !isLoading && (
            <div className={styles.emptyState}><Trans i18nKey="command-palette.context-action.no-options">No options found</Trans></div>
          )}
          {(() => {
            let selectableIndex = 0;
            return flatItems.map((item, idx) => {
              if (item.type === 'header') {
                return (
                  <div key={`header-${idx}`} className={styles.groupHeader} data-group-header>
                    {item.label}
                  </div>
                );
              }
              const currentSelectableIndex = selectableIndex++;
              const isActive = currentSelectableIndex === activeIndex;
              const isSelected = selectedIds.has(item.option.id);
              return (
                <div
                  key={item.option.id}
                  data-index={currentSelectableIndex}
                  className={cx(styles.option, isActive && styles.optionActive)}
                  role="option"
                  aria-selected={isActive}
                  tabIndex={0}
                  onClick={() => handleSelectOption(item.option)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectOption(item.option);
                    }
                  }}
                  onMouseEnter={() => setActiveIndex(currentSelectableIndex)}
                >
                  {isMultiSelect && (
                    <Checkbox value={isSelected} className={styles.checkbox} />
                  )}
                  {item.option.icon && <span className={styles.optionIcon}>{item.option.icon}</span>}
                  <span className={styles.optionLabel}>{item.option.label}</span>
                  {item.option.description && (
                    <span className={styles.optionDescription}>{item.option.description}</span>
                  )}
                </div>
              );
            });
          })()}
        </div>
        {currentStep.helpPanel && (
          <div className={styles.helpPanel}>
            {currentStep.helpPanel.sections.map((section, si) => (
              <div key={si} className={styles.helpSection}>
                <div className={styles.helpSectionTitle}>{section.title}</div>
                <div className={styles.helpItems}>
                  {section.items.map((item, ii) => (
                    <div key={ii} className={styles.helpItem}>
                      <code className={styles.helpSymbol}>{item.symbol}</code>
                      {item.description && <span className={styles.helpDescription}>{item.description}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={styles.footer}>
        <span className={styles.footerHint}>
          <kbd className={styles.kbd}><Trans i18nKey="command-palette.context-action.esc-key">ESC</Trans></kbd>
          <span><Trans i18nKey="command-palette.context-action.back">Back</Trans></span>
        </span>
        <span className={styles.footerHint}>
          <kbd className={styles.kbd}>↵</kbd>
          <span><Trans i18nKey="command-palette.context-action.select">Select</Trans></span>
        </span>
        <span className={styles.footerHint}>
          <kbd className={styles.kbd}>⌘</kbd>
          <kbd className={styles.kbd}><Trans i18nKey="command-palette.context-action.enter-key">Enter</Trans></kbd>
          <span><Trans i18nKey="command-palette.context-action.done">Done</Trans></span>
        </span>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    inputContainer: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(1, 2),
      borderBottom: '1px solid rgba(83, 83, 85, 0.5)',
      position: 'relative',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': { display: 'none' },
    }),
    backButton: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'none',
      border: 'none',
      padding: 0,
      marginRight: theme.spacing(1),
      cursor: 'pointer',
      color: theme.colors.text.secondary,
      flexShrink: 0,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
    breadcrumbs: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      flexShrink: 0,
      marginRight: theme.spacing(0.5),
    }),
    pill: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0, 0.5),
      background: 'rgba(255, 255, 255, 0.10)',
      borderRadius: theme.shape.radius.default,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
      whiteSpace: 'nowrap',
    }),
    separator: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    selectedSummary: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: 200,
    }),
    input: css({
      flex: 1,
      minWidth: 120,
      outline: 'none',
      border: 'none',
      background: 'transparent',
      color: theme.colors.text.secondary,
      fontFamily: 'Inter, sans-serif',
      fontSize: 18,
      fontStyle: 'normal',
      fontWeight: 400,
      lineHeight: '24px',
      letterSpacing: '-0.045px',
      '&::placeholder': {
        color: theme.colors.text.secondary,
      },
    }),
    loadingBarContainer: css({
      position: 'relative',
      left: 0,
      right: 0,
      height: 0,
    }),
    list: css({
      maxHeight: 400,
      overflowY: 'auto',
      padding: theme.spacing(0.5, 0),
    }),
    groupHeader: css({
      padding: theme.spacing(1.5, 2, 0.5, 2),
      fontFamily: 'Inter, sans-serif',
      fontSize: 12,
      fontStyle: 'normal',
      fontWeight: 500,
      lineHeight: '18px',
      letterSpacing: '0.018px',
      color: theme.colors.text.secondary,
    }),
    option: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 2),
      cursor: 'pointer',
      borderRadius: theme.shape.radius.default,
      margin: theme.spacing(0, 1),
    }),
    optionActive: css({
      borderRadius: theme.shape.radius.default,
      background: 'rgba(204, 204, 220, 0.12)',
    }),
    optionIcon: css({
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
    }),
    optionLabel: css({
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    optionDescription: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      flexShrink: 0,
    }),
    checkbox: css({
      flexShrink: 0,
    }),
    splitContainer: css({
      display: 'flex',
      flexDirection: 'row',
    }),
    listWithPanel: css({
      flex: 1,
      minWidth: 0,
      borderRight: '1px solid rgba(83, 83, 85, 0.5)',
    }),
    helpPanel: css({
      flex: '0 0 260px',
      maxHeight: 400,
      overflowY: 'auto',
      padding: theme.spacing(2),
    }),
    helpSection: css({
      marginBottom: theme.spacing(2),
      '&:last-child': {
        marginBottom: 0,
      },
    }),
    helpSectionTitle: css({
      fontFamily: 'Inter, sans-serif',
      fontSize: 12,
      fontWeight: 500,
      lineHeight: '18px',
      letterSpacing: '0.018px',
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(1),
    }),
    helpItems: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
    }),
    helpItem: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    helpSymbol: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(0.25, 0.75),
      background: 'rgba(255, 255, 255, 0.08)',
      borderRadius: theme.shape.radius.default,
      fontFamily: 'monospace',
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.link,
      whiteSpace: 'nowrap',
      minWidth: 24,
    }),
    helpDescription: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    emptyState: css({
      padding: theme.spacing(3, 2),
      textAlign: 'center',
      color: theme.colors.text.secondary,
    }),
    footer: css({
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: theme.spacing(2),
      padding: theme.spacing(0.75, 2),
      borderTop: '1px solid rgba(83, 83, 85, 0.5)',
    }),
    footerHint: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    kbd: css({
      padding: theme.spacing(0, 0.5),
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      fontSize: '10px',
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: '18px',
    }),
  };
}

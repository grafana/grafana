import { css, cx } from '@emotion/css';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { firstValueFrom } from 'rxjs';

import { GrafanaTheme2, fuzzySearch } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  GroupByVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  VariableValueOption,
  VizPanel,
} from '@grafana/scenes';
import { Button, Icon, Input, useStyles2, Checkbox, Portal } from '@grafana/ui';

export class PanelGroupByAction extends SceneObjectBase {
  static Component = PanelGroupByActionRenderer;

  private _groupByVariable: GroupByVariable | undefined;

  constructor() {
    super({});
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    const panel = this.parent;
    if (!panel || !(panel instanceof VizPanel)) {
      throw new Error('PanelGroupByAction can be used only for VizPanel');
    }

    this._groupByVariable = sceneGraph
      .getVariables(this)
      .state.variables.find((variable) => variable instanceof GroupByVariable);
  };

  public getGroupByVariable() {
    return this._groupByVariable;
  }
}

function PanelGroupByActionRenderer({ model }: SceneComponentProps<PanelGroupByAction>) {
  const groupByVariable = model.getGroupByVariable();
  const groupByState = groupByVariable?.useState();
  const styles = useStyles2(getStyles);

  // Track temporary selections (not applied yet)
  const [selectedItems, setSelectedItems] = useState<VariableValueOption[]>([]);
  // Track search input
  const [searchValue, setSearchValue] = useState('');
  // Track loading state
  const [isLoading, setIsLoading] = useState(false);
  // Track dropdown open state
  const [isOpen, setIsOpen] = useState(false);

  // Refs for positioning and click outside detection
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check if an option is selected in temp state
  const isOptionSelected = useCallback(
    (item: VariableValueOption) => selectedItems.some((opt) => opt.value === item.value),
    [selectedItems]
  );

  // Toggle selection in temp state
  const handleItemClick = useCallback(
    (item: VariableValueOption) => {
      if (isOptionSelected(item)) {
        setSelectedItems(selectedItems.filter((opt) => opt.value !== item.value));
      } else {
        setSelectedItems([...selectedItems, item]);
      }
    },
    [isOptionSelected, selectedItems]
  );

  // Apply selections and close dropdown
  const handleApply = () => {
    const groupByVariable = model.getGroupByVariable();
    const selectedValues = selectedItems.map((item) => item.value);
    if (groupByVariable) {
      groupByVariable.changeValueTo(selectedValues, selectedValues, true);
    }
    setIsOpen(false);
  };

  // Cancel and close dropdown
  const handleCancel = () => {
    setIsOpen(false);
  };

  // Toggle dropdown open/close
  const handleToggle = async () => {
    const newOpenState = !isOpen;
    setIsOpen(newOpenState);

    if (newOpenState) {
      // If groupBy has no options, fetch them
      if (groupByVariable && (!groupByState?.options || groupByState.options.length === 0)) {
        setIsLoading(true);
        try {
          await firstValueFrom(groupByVariable.validateAndUpdate());
        } catch (error) {
          console.error('Failed to fetch group by options:', error);
        } finally {
          setIsLoading(false);
        }
      }
      setSearchValue('');
    }
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter options based on search using fuzzy search
  const filteredOptions = useMemo(() => {
    if (!groupByState?.options) {
      return [];
    }

    if (!searchValue) {
      return groupByState.options;
    }

    const haystack = groupByState.options.map((option) => option.label);
    const indices = fuzzySearch(haystack, searchValue);
    return indices.map((idx) => groupByState.options[idx]);
  }, [groupByState?.options, searchValue]);

  if (!groupByState) {
    return null;
  }

  // Calculate menu position based on button position
  const getMenuPosition = () => {
    if (!buttonRef.current) {
      return { top: 0, left: 0 };
    }
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + 4,
      left: rect.left,
    };
  };

  const menuPosition = getMenuPosition();

  return (
    <>
      <Button variant="secondary" size="sm" ref={buttonRef} onClick={handleToggle}>
        <Trans i18nKey="panel-group-by.button">Group by</Trans>
        <Icon name="angle-down" />
      </Button>

      {isOpen && (
        <Portal>
          <div
            ref={menuRef}
            className={styles.menuContainer}
            style={{
              position: 'fixed',
              top: menuPosition.top,
              left: menuPosition.left,
              zIndex: 1060,
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
            <div className={styles.searchContainer} onClick={(e) => e.stopPropagation()}>
              <Input
                prefix={<Icon name="search" />}
                placeholder={t('panel-group-by.search-placeholder', 'Search...')}
                value={searchValue}
                onChange={(e) => setSearchValue(e.currentTarget.value)}
              />
            </div>
            <div className={styles.listContainer}>
              {isLoading ? (
                <div className={styles.emptyMessage}>
                  <Trans i18nKey="panel-group-by.loading">Loading options...</Trans>
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className={styles.emptyMessage}>
                  <Trans i18nKey="panel-group-by.no-options">No options found</Trans>
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = isOptionSelected(option);
                  return (
                    <div
                      key={option.value as string}
                      className={cx(styles.option)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemClick(option);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleItemClick(option);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                    >
                      <Checkbox value={isSelected} onChange={() => handleItemClick(option)} />
                      <span className={styles.optionLabel}>{option.label}</span>
                    </div>
                  );
                })
              )}
            </div>
            <div className={styles.applyContainer}>
              <Button onClick={handleApply}>
                <Trans i18nKey="panel-group-by.apply">Apply</Trans>
              </Button>
              <Button onClick={handleCancel} variant="secondary" fill="outline">
                <Trans i18nKey="panel-group-by.cancel">Cancel</Trans>
              </Button>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  menuContainer: css({
    display: 'flex',
    flexDirection: 'column',
    width: '300px',
    maxHeight: '400px',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
  }),
  searchContainer: css({
    padding: theme.spacing(1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  listContainer: css({
    flex: 1,
    overflow: 'auto',
    minHeight: '200px',
    maxHeight: '300px',
    padding: theme.spacing(0.5),
  }),
  option: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    cursor: 'pointer',
    borderRadius: theme.shape.radius.default,
    '&:hover': {
      background: theme.colors.background.secondary,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: '-2px',
    },
  }),
  optionLabel: css({
    flex: 1,
  }),
  emptyMessage: css({
    padding: theme.spacing(2),
    textAlign: 'center',
    color: theme.colors.text.secondary,
  }),
  applyContainer: css({
    display: 'flex',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
});

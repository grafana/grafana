import { cx } from '@emotion/css';
import {
  FloatingFocusManager,
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { hotkeysCoreFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEventHandler,
  type ReactNode,
  type RefCallback,
} from 'react';

import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { Input } from '../Input/Input';
import { Stack } from '../Layout/Stack/Stack';
import { Portal } from '../Portal/Portal';

import { getTreeSelectStyles } from './TreeSelect.styles';
import { type CascaderOption } from './types';

interface TreeSelectTriggerProps {
  ref: RefCallback<HTMLButtonElement>;
  onClick: MouseEventHandler<HTMLButtonElement>;
  'aria-controls': string;
  'aria-expanded': boolean;
  'aria-haspopup': 'tree';
}

export interface TreeSelectProps {
  separator?: string;
  placeholder?: string;
  options: CascaderOption[];
  onSelect(value: string): void;
  width?: number;
  initialValue?: string;
  allowCustomValue?: boolean;
  formatCreateLabel?: (value: string) => string;
  displayAllSelectedLevels?: boolean;
  onBlur?: () => void;
  autoFocus?: boolean;
  alwaysOpen?: boolean;
  disabled?: boolean;
  id?: string;
  isClearable?: boolean;
  'data-testid'?: string;
}

interface CascaderTreeNode {
  id: string;
  value: string;
  label: string;
  menuLabel: string;
  displayLabel: string;
  children: string[];
  folder: boolean;
  disabled: boolean;
  path: CascaderOption[];
  customDescription?: string;
}

interface CascaderTreeData {
  nodes: Map<string, CascaderTreeNode>;
  expandedItems: string[];
}

interface SelectedValue {
  value: string;
  label: string;
}

export interface HeadlessTreeSelectProps extends TreeSelectProps {
  changeOnSelect?: boolean;
  hideActiveLevelLabel?: boolean;
  valuePath?: string[];
  onChangePath?: (values: string[], options: CascaderOption[]) => void;
  loadData?: (options: CascaderOption[]) => void;
  onOpenChange?: (open: boolean) => void;
  renderTrigger?: (props: TreeSelectTriggerProps, open: boolean) => ReactNode;
  className?: string;
}

const DEFAULT_SEPARATOR = ' / ';
const ROOT_ID = '__grafana_cascader_root__';
const CUSTOM_ID = '__grafana_cascader_custom__';

function buildTreeData(
  options: CascaderOption[],
  query: string,
  separator: string,
  displayAllSelectedLevels: boolean,
  allowCustomValue: boolean,
  formatCreateLabel?: (value: string) => string
): CascaderTreeData {
  const nodes = new Map<string, CascaderTreeNode>();
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const addOptions = (
    items: CascaderOption[],
    path: string[],
    optionPath: CascaderOption[],
    indices: number[]
  ): string[] => {
    return items.flatMap((option, index) => {
      const nextPath = [...path, option.label];
      const nextOptionPath = [...optionPath, option];
      const id = `option-${[...indices, index].join('-')}`;
      const children = addOptions(
        option.items ?? option.children ?? [],
        nextPath,
        nextOptionPath,
        [...indices, index]
      );
      const matches = !normalizedQuery || nextPath.join(' ').toLocaleLowerCase().includes(normalizedQuery);

      if (!matches && children.length === 0) {
        return [];
      }

      nodes.set(id, {
        id,
        value: option.value,
        label: option.label,
        menuLabel: normalizedQuery ? nextPath.join(separator) : option.label,
        displayLabel: displayAllSelectedLevels ? nextPath.join(separator) : option.label,
        children,
        folder: children.length > 0 || option.isLeaf === false,
        disabled: Boolean(option.disabled),
        path: nextOptionPath,
      });
      return [id];
    });
  };

  const rootChildren = addOptions(options, [], [], []);
  const hasExactMatch = [...nodes.values()].some(
    (node) => node.children.length === 0 && (node.value === query || node.label === query)
  );

  if (allowCustomValue && query && !hasExactMatch) {
    nodes.set(CUSTOM_ID, {
      id: CUSTOM_ID,
      value: query,
      label: query,
      menuLabel: query,
      displayLabel: query,
      children: [],
      folder: false,
      disabled: false,
      path: [{ value: query, label: query }],
      customDescription: formatCreateLabel?.(query),
    });
    rootChildren.unshift(CUSTOM_ID);
  }

  nodes.set(ROOT_ID, {
    id: ROOT_ID,
    value: '',
    label: '',
    menuLabel: '',
    displayLabel: '',
    children: rootChildren,
    folder: true,
    disabled: false,
    path: [],
  });

  return {
    nodes,
    expandedItems: normalizedQuery
      ? [...nodes.values()].filter((node) => node.children.length > 0).map((node) => node.id)
      : [],
  };
}

function findInitialValue(
  options: CascaderOption[],
  initialValue: string | undefined,
  separator: string,
  displayAllSelectedLevels: boolean,
  allowCustomValue: boolean
): SelectedValue | null {
  if (!initialValue) {
    return null;
  }

  const data = buildTreeData(options, '', separator, displayAllSelectedLevels, false);
  const option = [...data.nodes.values()].find(
    (node) => node.id !== ROOT_ID && (node.value === initialValue || node.label === initialValue)
  );

  if (option) {
    return { value: option.value, label: option.displayLabel };
  }

  return allowCustomValue ? { value: initialValue, label: initialValue } : null;
}

interface CascaderTreeProps {
  data: CascaderTreeData;
  menuId: string;
  selectedValue?: string;
  onActivate(node: CascaderTreeNode, isFolder: boolean): void;
}

function CascaderTree({ data, menuId, selectedValue, onActivate }: CascaderTreeProps) {
  const styles = useStyles2(getTreeSelectStyles);
  const tree = useTree<CascaderTreeNode>({
    rootItemId: ROOT_ID,
    getItemName: (item) => item.getItemData().menuLabel,
    isItemFolder: (item) => item.getItemData().folder,
    dataLoader: {
      getItem: (itemId) => data.nodes.get(itemId)!,
      getChildren: (itemId) => data.nodes.get(itemId)?.children ?? [],
    },
    initialState: { expandedItems: data.expandedItems },
    onPrimaryAction: (item) => {
      const node = item.getItemData();
      if (!node.disabled) {
        onActivate(node, item.isFolder());
      }
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  useEffect(() => {
    tree.rebuildTree();
  }, [data, tree]);

  const containerProps = tree.getContainerProps(t('grafana-ui.tree-select.tree-label', 'Available options'));
  const items = tree.getItems();
  if (items.length === 0) {
    return (
      <div {...containerProps} id={menuId} className={styles.tree}>
        <div className={styles.empty}>{t('grafana-ui.tree-select.no-options', 'No options found.')}</div>
      </div>
    );
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    containerProps.onKeyDown?.(event);
    if (event.defaultPrevented || !['Enter', ' '].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const item = tree.getFocusedItem();
    if (item.isFolder()) {
      item.isExpanded() ? item.collapse() : item.expand();
    } else {
      item.primaryAction();
    }
  };

  return (
    <div {...containerProps} id={menuId} className={styles.tree} onKeyDown={handleKeyDown}>
      {items.map((item) => {
        const node = item.getItemData();
        const itemProps = item.getProps();
        const selected = node.value === selectedValue;

        return (
          <button
            key={item.getId()}
            {...itemProps}
            type="button"
            aria-disabled={node.disabled || undefined}
            aria-selected={selected}
            className={cx(styles.item, selected && styles.selected, node.disabled && styles.disabled)}
            onClick={node.disabled ? undefined : itemProps.onClick}
            style={{ paddingLeft: 8 + item.getItemMeta().level * 16 }}
          >
            {item.isFolder() && <Icon name={item.isExpanded() ? 'angle-down' : 'angle-right'} />}
            <span className={styles.itemText}>
              <span className={styles.label}>{node.menuLabel}</span>
              {node.customDescription && <span className={styles.description}>{node.customDescription}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * A lightweight tree selector for leaf-only Cascader use cases.
 *
 * @alpha
 */
export const HeadlessTreeSelect = memo(
  ({
    separator = DEFAULT_SEPARATOR,
    placeholder,
    options,
    onSelect,
    width,
    initialValue,
    allowCustomValue = false,
    formatCreateLabel,
    displayAllSelectedLevels = false,
    onBlur,
    autoFocus,
    alwaysOpen = false,
    disabled,
    id,
    isClearable,
    changeOnSelect = false,
    hideActiveLevelLabel = false,
    valuePath,
    onChangePath,
    loadData,
    onOpenChange,
    renderTrigger,
    className,
    'data-testid': dataTestId,
  }: HeadlessTreeSelectProps) => {
    const styles = useStyles2(getTreeSelectStyles);
    const menuId = `cascader-${useId().replace(/:/g, '-')}`;
    const [isOpen, setIsOpen] = useState(alwaysOpen);
    const [query, setQuery] = useState('');
    const controlledValue = valuePath?.at(-1);
    const [selected, setSelected] = useState<SelectedValue | null>(() =>
      findInitialValue(
        options,
        controlledValue ?? initialValue,
        separator,
        displayAllSelectedLevels,
        allowCustomValue
      )
    );
    const open = alwaysOpen || isOpen;
    const data = useMemo(
      () => buildTreeData(options, query, separator, displayAllSelectedLevels, allowCustomValue, formatCreateLabel),
      [allowCustomValue, displayAllSelectedLevels, formatCreateLabel, options, query, separator]
    );

    useEffect(() => {
      if (valuePath) {
        setSelected(
          findInitialValue(options, controlledValue, separator, displayAllSelectedLevels, allowCustomValue)
        );
      }
    }, [allowCustomValue, controlledValue, displayAllSelectedLevels, options, separator, valuePath]);

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (disabled) {
          return;
        }
        if (!alwaysOpen) {
          setIsOpen(nextOpen);
        }
        if (nextOpen !== open) {
          onOpenChange?.(nextOpen);
        }
        if (!nextOpen) {
          setQuery('');
        }
      },
      [alwaysOpen, disabled, onOpenChange, open]
    );

    const { context, refs, floatingStyles } = useFloating({
      open,
      onOpenChange: handleOpenChange,
      placement: 'bottom-start',
      middleware: [offset(4), flip(), shift({ padding: 8 })],
      whileElementsMounted: autoUpdate,
    });
    const click = useClick(context, { enabled: !disabled });
    const dismiss = useDismiss(context);
    const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

    const handleActivate = (node: CascaderTreeNode, isFolder: boolean) => {
      if (isFolder) {
        loadData?.(node.path);
        if (!changeOnSelect) {
          return;
        }
      }

      if (valuePath === undefined) {
        setSelected({ value: node.value, label: hideActiveLevelLabel ? '' : node.displayLabel });
      }
      setQuery('');
      if (!isFolder) {
        handleOpenChange(false);
      }
      onSelect(node.value);
      onChangePath?.(
        node.path.map((option) => option.value),
        node.path
      );
    };

    const focusFirstTreeItem = () => {
      requestAnimationFrame(() => {
        document.getElementById(menuId)?.querySelector<HTMLElement>('[role="treeitem"]')?.focus();
      });
    };

    return (
      <div className={className} data-testid={dataTestId}>
        {renderTrigger ? (
          renderTrigger(
            {
              ref: refs.setReference,
              onClick: () => handleOpenChange(!open),
              'aria-controls': menuId,
              'aria-expanded': open,
              'aria-haspopup': 'tree',
            },
            open
          )
        ) : (
          <Input
            {...getReferenceProps({
              onBlur,
              onChange: (event: ChangeEvent<HTMLInputElement>) => {
                setQuery(event.currentTarget.value);
                handleOpenChange(true);
              },
              onFocus: (event: FocusEvent<HTMLInputElement>) => event.currentTarget.select(),
              onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key === 'ArrowDown' && open) {
                  event.preventDefault();
                  focusFirstTreeItem();
                }
              },
            })}
            ref={refs.setReference}
            id={id}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={menuId}
            aria-expanded={open}
            aria-haspopup="tree"
            autoFocus={autoFocus}
            disabled={disabled}
            placeholder={placeholder}
            value={open ? query : selected?.label ?? ''}
            width={width}
            suffix={
              <Stack gap={0.5}>
                {isClearable && selected && (
                  <IconButton
                    name="times"
                    aria-label={t('grafana-ui.tree-select.clear-button', 'Clear selection')}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSelected(null);
                      setQuery('');
                      onSelect('');
                      onChangePath?.([], []);
                    }}
                  />
                )}
                <Icon name={open ? 'angle-up' : 'angle-down'} />
              </Stack>
            }
          />
        )}
        {open && (
          <Portal>
            <FloatingFocusManager context={context} initialFocus={-1} modal={false} returnFocus={false}>
              <div
                {...getFloatingProps()}
                ref={refs.setFloating}
                className={styles.menu}
                style={{
                  ...floatingStyles,
                  minWidth: refs.reference.current?.getBoundingClientRect().width,
                }}
              >
                <CascaderTree
                  key={query || 'default'}
                  data={data}
                  menuId={menuId}
                  selectedValue={selected?.value}
                  onActivate={handleActivate}
                />
              </div>
            </FloatingFocusManager>
          </Portal>
        )}
      </div>
    );
  }
);

HeadlessTreeSelect.displayName = 'HeadlessTreeSelect';

export const TreeSelectImplementation = memo((props: TreeSelectProps) => <HeadlessTreeSelect {...props} />);

TreeSelectImplementation.displayName = 'TreeSelectImplementation';

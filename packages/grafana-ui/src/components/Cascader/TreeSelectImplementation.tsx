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
import {
  lazy,
  memo,
  Suspense,
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

import { TREE_ROOT_ID, type TreeSelectData, type TreeSelectNode } from './TreeSelect.data';
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

interface SelectedValue {
  value: string;
  label: string;
}

export interface TreeSelectBaseProps extends TreeSelectProps {
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
const CUSTOM_ID = '__grafana_cascader_custom__';

const LazyTreeSelectMenu = lazy(() =>
  import(/* webpackChunkName: "headless-tree-select" */ './TreeSelectMenu').then((module) => ({
    default: module.TreeSelectMenu,
  }))
);

function buildTreeData(
  options: CascaderOption[],
  query: string,
  separator: string,
  displayAllSelectedLevels: boolean,
  allowCustomValue: boolean,
  formatCreateLabel?: (value: string) => string
): TreeSelectData {
  const nodes = new Map<string, TreeSelectNode>();
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
      const children = addOptions(option.items ?? option.children ?? [], nextPath, nextOptionPath, [...indices, index]);
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

  nodes.set(TREE_ROOT_ID, {
    id: TREE_ROOT_ID,
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
    (node) => node.id !== TREE_ROOT_ID && (node.value === initialValue || node.label === initialValue)
  );

  if (option) {
    return { value: option.value, label: option.displayLabel };
  }

  return allowCustomValue ? { value: initialValue, label: initialValue } : null;
}

/**
 * A lightweight tree selector for leaf-only Cascader use cases.
 *
 * @alpha
 */
export const TreeSelectBase = memo(
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
  }: TreeSelectBaseProps) => {
    const styles = useStyles2(getTreeSelectStyles);
    const menuId = `cascader-${useId().replace(/:/g, '-')}`;
    const [isOpen, setIsOpen] = useState(alwaysOpen);
    const [query, setQuery] = useState('');
    const controlledValue = valuePath?.at(-1);
    const [selected, setSelected] = useState<SelectedValue | null>(() =>
      findInitialValue(options, controlledValue ?? initialValue, separator, displayAllSelectedLevels, allowCustomValue)
    );
    const open = alwaysOpen || isOpen;
    const data = useMemo(
      () => buildTreeData(options, query, separator, displayAllSelectedLevels, allowCustomValue, formatCreateLabel),
      [allowCustomValue, displayAllSelectedLevels, formatCreateLabel, options, query, separator]
    );

    useEffect(() => {
      if (valuePath) {
        setSelected(findInitialValue(options, controlledValue, separator, displayAllSelectedLevels, allowCustomValue));
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

    const handleActivate = (node: TreeSelectNode, isFolder: boolean) => {
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
            value={open ? query : (selected?.label ?? '')}
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
                <Suspense
                  fallback={
                    <div
                      id={menuId}
                      role="tree"
                      aria-label={t('grafana-ui.tree-select.tree-label', 'Available options')}
                      className={styles.tree}
                    >
                      <div className={styles.empty}>
                        {t('grafana-ui.tree-select.loading-options', 'Loading options...')}
                      </div>
                    </div>
                  }
                >
                  <LazyTreeSelectMenu
                    key={query || 'default'}
                    data={data}
                    menuId={menuId}
                    selectedValue={selected?.value}
                    onActivate={handleActivate}
                  />
                </Suspense>
              </div>
            </FloatingFocusManager>
          </Portal>
        )}
      </div>
    );
  }
);

TreeSelectBase.displayName = 'TreeSelectBase';

import { css } from '@emotion/css';
import {
  Fragment,
  forwardRef,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from 'react';

import { type GrafanaTheme2, type ScopeSpecFilter, reverseScopeFilterOperatorMap } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { useScopesServices } from '../ScopesContextProvider';

import { type ScopesSelectorService } from './ScopesSelectorService';

export interface ScopeMetadataProps {
  title?: string;
  description?: string;
  filters?: ScopeSpecFilter[];
}

export function hasScopeMetadata({ description, filters }: Pick<ScopeMetadataProps, 'description' | 'filters'>) {
  return Boolean(description || (filters && filters.length > 0));
}

function formatFilter({ key, value, values, operator }: ScopeSpecFilter) {
  const symbol = reverseScopeFilterOperatorMap[operator] ?? operator;
  const operand = values && values.length > 0 ? values.join(', ') : value;
  return `${key} ${symbol} ${operand}`;
}

/**
 * Description and label filters of a scope, shared by the selector tree and the applied scopes tooltip.
 */
export function ScopeMetadata({ title, description, filters }: ScopeMetadataProps) {
  const styles = useStyles2(getStyles);
  const hasFilters = Boolean(filters && filters.length > 0);

  return (
    <Stack direction="column" gap={0.5} alignItems="flex-start">
      {title && <Text weight="medium">{title}</Text>}
      {description && (
        <div>
          <div className={styles.heading}>{t('scopes.selector.metadata.description', 'Description')}</div>
          <div className={styles.description}>{description}</div>
        </div>
      )}
      {hasFilters && (
        <div>
          <div className={styles.heading}>{t('scopes.selector.metadata.filters', 'Filters')}</div>
          <ul className={styles.filters}>
            {filters!.map((filter, i) => (
              <li key={`${filter.key}-${i}`} className={styles.filter}>
                {formatFilter(filter)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Stack>
  );
}

export interface ScopeMetadataSource {
  scopeId: string;
  // Node the scope was picked from. Falls back to the last element of the scope's defaultPath.
  nodeId?: string;
  title?: string;
}

export interface LoadedScopeMetadata extends ScopeMetadataProps {
  scopeId: string;
}

async function loadScopeMetadata(
  service: ScopesSelectorService,
  { scopeId, nodeId, title }: ScopeMetadataSource
): Promise<LoadedScopeMetadata> {
  const scope = await service.getScope(scopeId);
  const resolvedNodeId = nodeId ?? scope?.spec.defaultPath?.at(-1);
  const node = resolvedNodeId ? await service.getScopeNode(resolvedNodeId) : undefined;
  // Only trust a node that actually links to this scope, so a category's description is never shown for a scope.
  const description = node?.spec.linkId === scopeId ? node.spec.description : undefined;
  return { scopeId, title, description, filters: scope?.spec.filters };
}

/**
 * Loads the description and filters of the given scopes while `enabled`, through the cached selector service.
 * Returns nothing until the load has finished, and also when it fails.
 */
export function useScopeMetadata(sources: ScopeMetadataSource[], enabled: boolean): LoadedScopeMetadata[] {
  const service = useScopesServices()?.scopesSelectorService;
  const [loaded, setLoaded] = useState<LoadedScopeMetadata[]>([]);
  const sourcesKey = sources.map((s) => `${s.scopeId}|${s.nodeId ?? ''}|${s.title ?? ''}`).join(',');

  useEffect(() => {
    if (!enabled || !service) {
      return;
    }
    let cancelled = false;
    Promise.all(sources.map((source) => loadScopeMetadata(service, source)))
      .then((result) => {
        if (!cancelled) {
          setLoaded(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded([]);
        }
      });
    return () => {
      cancelled = true;
    };
    // sourcesKey stands in for sources, which is a new array on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, service, sourcesKey]);

  return loaded;
}

// Only the tooltip that was interacted with last is shown, so a hovered tooltip gives way when the keyboard highlight
// moves to another scope, and the other way around. When the pointer leaves the tooltip that took over, the one for
// the keyboard highlight is shown again.
let activeTooltipId: string | undefined;
let highlightedTooltipId: string | undefined;
const activeTooltipListeners = new Set<() => void>();

function setActiveTooltipId(id: string | undefined) {
  if (activeTooltipId !== id) {
    activeTooltipId = id;
    activeTooltipListeners.forEach((listener) => listener());
  }
}

function releaseActiveTooltip(id: string) {
  if (activeTooltipId === id) {
    setActiveTooltipId(highlightedTooltipId);
  }
}

function subscribeToActiveTooltip(listener: () => void) {
  activeTooltipListeners.add(listener);
  return () => {
    activeTooltipListeners.delete(listener);
  };
}

interface ScopeMetadataTooltipProps {
  sources: ScopeMetadataSource[];
  // Show the tooltip for the item that has keyboard focus through aria-activedescendant
  highlighted?: boolean;
  className?: string;
  // Receives the id of the element describing the scope, once there is something to describe. It has to be set as
  // aria-describedby on the element that assistive technology treats as focused (the control, or the tree item when
  // focus stays in the search input).
  children: (descriptionId: string | undefined) => JSX.Element;
}

interface AnchorProps {
  className?: string;
  children: ReactNode;
  onActiveChange: (active: boolean) => void;
}

// Tooltip clones its child to inject a tab stop, aria-describedby and its own hover and focus handling. We control
// visibility ourselves (the tooltip must stay hidden when there is nothing to show), so only the ref is used. The
// extra tab stop is dropped and the description is wired to the focused element by ScopeMetadataTooltip instead,
// because this wrapper is never the element that has focus.
const TooltipAnchor = forwardRef<HTMLDivElement, AnchorProps>(function TooltipAnchor(
  { className, children, onActiveChange },
  ref
) {
  return (
    // Only observes hover and focus of the interactive children, it is not a control itself
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={ref}
      className={className}
      onMouseEnter={() => onActiveChange(true)}
      onMouseLeave={() => onActiveChange(false)}
      onFocus={() => onActiveChange(true)}
      onBlur={() => onActiveChange(false)}
    >
      {children}
    </div>
  );
});

/**
 * Shows a scope's description and filters in a tooltip while its child is hovered or focused. The metadata is loaded
 * on first interaction and nothing is shown when the scope has neither a description nor filters.
 */
export function ScopeMetadataTooltip({ sources, highlighted, className, children }: ScopeMetadataTooltipProps) {
  const styles = useStyles2(getStyles);
  const id = useId();
  const activeId = useSyncExternalStore(subscribeToActiveTooltip, () => activeTooltipId);
  const [active, setActive] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const interacted = active || Boolean(highlighted);
  const loaded = useScopeMetadata(sources, interacted);

  const metadata = loaded.filter(hasScopeMetadata);
  const open = interacted && activeId === id && !dismissed && metadata.length > 0;

  useEffect(() => {
    if (!highlighted) {
      return;
    }
    // A tooltip dismissed with Escape comes back when the highlight returns to the item
    setDismissed(false);
    highlightedTooltipId = id;
    setActiveTooltipId(id);
    return () => {
      if (highlightedTooltipId === id) {
        highlightedTooltipId = undefined;
      }
    };
  }, [highlighted, id]);

  useEffect(() => {
    return () => {
      if (activeTooltipId === id) {
        setActiveTooltipId(undefined);
      }
    };
  }, [id]);

  // The pointer can hover without focus being inside the anchor, so listen on the window while the tooltip is open.
  // Capturing and stopping the event means Escape only dismisses the tooltip, and does not also reach the drawer that
  // contains the tree (which would close it) or the tree's own Escape handling.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setDismissed(true);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  const onActiveChange = (value: boolean) => {
    setActive(value);
    if (value) {
      setDismissed(false);
      setActiveTooltipId(id);
    } else {
      releaseActiveTooltip(id);
    }
  };

  const descriptionId = metadata.length > 0 ? `${id}-description` : undefined;
  const content = (
    <Stack direction="column" gap={1} alignItems="flex-start">
      {metadata.map(({ scopeId, title, description, filters }, i) => (
        <Fragment key={scopeId}>
          {i > 0 && <hr className={styles.divider} />}
          <ScopeMetadata title={title} description={description} filters={filters} />
        </Fragment>
      ))}
    </Stack>
  );

  return (
    <Tooltip show={open} placement="right" content={content}>
      <TooltipAnchor className={className} onActiveChange={onActiveChange}>
        {children(descriptionId)}
        {descriptionId && (
          // Referenced by aria-describedby, which also works while the tooltip itself is not rendered
          <div id={descriptionId} hidden>
            {content}
          </div>
        )}
      </TooltipAnchor>
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  divider: css({
    alignSelf: 'stretch',
    margin: 0,
    border: 0,
    borderTop: `1px solid ${theme.colors.border.medium}`,
  }),
  description: css({
    color: theme.colors.text.secondary,
    maxWidth: 320,
    textAlign: 'left',
  }),
  heading: css({
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.bodySmall.fontSize,
    marginBottom: theme.spacing(0.25),
  }),
  filters: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
    textAlign: 'left',
  }),
  filter: css({
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    wordBreak: 'break-all',
  }),
});

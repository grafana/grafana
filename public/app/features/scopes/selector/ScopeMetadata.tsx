import { css } from '@emotion/css';
import { forwardRef, useEffect, useState, type JSX } from 'react';

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

interface LoadedScopeMetadata extends ScopeMetadataProps {
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

interface ScopeMetadataTooltipProps {
  sources: ScopeMetadataSource[];
  // Show the tooltip for the item that has keyboard focus through aria-activedescendant
  highlighted?: boolean;
  className?: string;
  children: JSX.Element;
}

interface AnchorProps {
  className?: string;
  children: JSX.Element;
  'aria-describedby'?: string;
  onActiveChange: (active: boolean) => void;
}

// Tooltip clones its child to inject a tab stop and its own hover and focus handling. We control visibility
// ourselves (the tooltip must stay hidden when there is nothing to show), so only the ref and aria-describedby
// are used and the extra tab stop is dropped.
const TooltipAnchor = forwardRef<HTMLDivElement, AnchorProps>(function TooltipAnchor(
  { className, children, 'aria-describedby': describedBy, onActiveChange },
  ref
) {
  return (
    // Only observes hover and focus of the interactive children, it is not a control itself
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={ref}
      className={className}
      aria-describedby={describedBy}
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
  const service = useScopesServices()?.scopesSelectorService;
  const [active, setActive] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState<LoadedScopeMetadata[]>([]);

  const sourcesKey = sources.map((s) => `${s.scopeId}|${s.nodeId ?? ''}|${s.title ?? ''}`).join(',');
  const interacted = active || Boolean(highlighted);

  useEffect(() => {
    if (!interacted || !service) {
      return;
    }
    let cancelled = false;
    Promise.all(sources.map((source) => loadScopeMetadata(service, source))).then((result) => {
      if (!cancelled) {
        setLoaded(result);
      }
    });
    return () => {
      cancelled = true;
    };
    // sourcesKey stands in for sources, which is a new array on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interacted, service, sourcesKey]);

  const metadata = loaded.filter(hasScopeMetadata);
  const open = interacted && !dismissed && metadata.length > 0;

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
    }
  };

  return (
    <Tooltip
      show={open}
      placement="right"
      content={
        <Stack direction="column" gap={1} alignItems="flex-start">
          {metadata.map(({ scopeId, title, description, filters }) => (
            <ScopeMetadata key={scopeId} title={title} description={description} filters={filters} />
          ))}
        </Stack>
      }
    >
      <TooltipAnchor className={className} onActiveChange={onActiveChange}>
        {children}
      </TooltipAnchor>
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
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

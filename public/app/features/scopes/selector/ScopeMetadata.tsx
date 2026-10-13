import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2, type Scope, type ScopeSpecFilter, reverseScopeFilterOperatorMap } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Text, useStyles2 } from '@grafana/ui';

import { useScopesServices } from '../ScopesContextProvider';

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

/**
 * Loads the scope behind a tree node on demand. Only rendered while the tooltip is open, so nothing is fetched
 * for nodes the user never hovers. The scope fetch is cached by the API layer.
 */
export function ScopeNodeMetadata({ description, scopeId }: { description?: string; scopeId?: string }) {
  const services = useScopesServices();
  const [scope, setScope] = useState<Scope | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (scopeId && services?.scopesSelectorService) {
      services.scopesSelectorService.getScope(scopeId).then((s) => !cancelled && setScope(s));
    }
    return () => {
      cancelled = true;
    };
  }, [scopeId, services?.scopesSelectorService]);

  return <ScopeMetadata description={description} filters={scope?.spec.filters} />;
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

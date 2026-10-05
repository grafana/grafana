import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2, locationUtil } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import {
  Button,
  Dropdown,
  ErrorBoundaryAlert,
  FilterInput,
  IconButton,
  Menu,
  ScrollContainer,
  Spinner,
  Stack,
  Text,
  Tooltip,
  useStyles2,
} from '@grafana/ui';

import { SectionSidebarDivider, SectionSidebarGroup, SectionSidebarItem } from './primitives';
import {
  type SectionSidebarAction,
  type SectionSidebarContext,
  type SectionSidebarDefinition,
  type SectionSidebarNewActions,
} from './types';
import { useDebouncedValue } from './utils';

export interface SectionSidebarProps {
  definition: SectionSidebarDefinition;
  context: SectionSidebarContext;
}

export function SectionSidebar({ definition, context }: SectionSidebarProps) {
  const styles = useStyles2(getStyles);
  const { actions: newActions, element: newActionsElement } = useNewActions(definition, context);

  return (
    <nav className={styles.sidebar} aria-label={definition.title}>
      {newActionsElement}
      <div className={styles.header}>
        <Text element="h2" variant="h5" truncate>
          {definition.title}
        </Text>
        <Stack gap={0.5} alignItems="center">
          <NewActionsControl actions={newActions} />
          {definition.headerActions?.map((action) => (
            <IconButton key={action.id} name={action.icon} tooltip={action.label} onClick={() => runAction(action)} />
          ))}
        </Stack>
      </div>
      <SectionSidebarBody definition={definition} context={context} />
    </nav>
  );
}

function SectionSidebarBody({
  definition,
  context,
}: {
  definition: SectionSidebarDefinition;
  context: SectionSidebarContext;
}) {
  const styles = useStyles2(getStyles);
  const search = definition.search;
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(search?.initialFilters);
  const isSearching = query.trim() !== '' || Boolean(search?.hasActiveFilters?.(filters));

  return (
    <>
      {search && (
        <div className={styles.search}>
          <FilterInput value={query} onChange={setQuery} placeholder={search.placeholder} escapeRegex={false} />
          {search.Filters && <search.Filters value={filters} onChange={setFilters} context={context} />}
        </div>
      )}
      <div className={styles.scrollArea}>
        <ScrollContainer height="100%" overflowX="hidden">
          <div className={styles.body}>
            {search && isSearching ? (
              <SectionSidebarSearchResults
                useResults={search.useResults}
                query={query}
                filters={filters}
                context={context}
              />
            ) : (
              renderGroups(definition, definition.groups, context)
            )}
          </div>
        </ScrollContainer>
      </div>
    </>
  );
}

function renderGroups(
  definition: SectionSidebarDefinition,
  groups: SectionSidebarDefinition['groups'],
  context: SectionSidebarContext
) {
  return groups.map(({ id, Component, dividerAfter }, index) => (
    <ErrorBoundaryAlert key={id} boundaryName={`section-sidebar-${definition.id}-${id}`}>
      <Component {...context} />
      {dividerAfter && index < groups.length - 1 && <SectionSidebarDivider />}
    </ErrorBoundaryAlert>
  ));
}

function SectionSidebarSearchResults({
  useResults,
  query,
  filters,
  context,
}: {
  useResults: NonNullable<SectionSidebarDefinition['search']>['useResults'];
  query: string;
  filters: unknown;
  context: SectionSidebarContext;
}) {
  const debouncedQuery = useDebouncedValue(query);
  const { items, loading, error } = useResults({ query: debouncedQuery, filters, context });

  if (error) {
    return (
      <Text color="error">
        <Trans i18nKey="section-sidebar.search.error">Search failed</Trans>
      </Text>
    );
  }

  return (
    <SectionSidebarGroup id="search-results" title={t('section-sidebar.search.results', 'Results')}>
      {loading && items.length === 0 && <Spinner />}
      {!loading && items.length === 0 && (
        <Text color="secondary" italic>
          <Trans i18nKey="section-sidebar.search.empty">No results found</Trans>
        </Text>
      )}
      {items.map((item) => (
        <SectionSidebarItem key={item.id} title={item.title} icon={item.icon} url={item.url} subtitle={item.subtitle} />
      ))}
    </SectionSidebarGroup>
  );
}

function useNewActions(definition: SectionSidebarDefinition, context: SectionSidebarContext) {
  // The hook comes from a fixed definition per section, so the call order is stable per mount
  const useActions = definition.useNewActions ?? noActions;
  return useActions(context);
}

function noActions(): SectionSidebarNewActions {
  return { actions: [] };
}

function runAction(action: SectionSidebarAction) {
  action.onClick?.();
  if (action.url) {
    locationService.push(locationUtil.stripBaseFromUrl(action.url));
  }
}

function NewActionsControl({ actions }: { actions: SectionSidebarAction[] }) {
  const label = t('section-sidebar.new', 'New');

  if (actions.length === 0) {
    return null;
  }

  if (actions.length === 1) {
    const [action] = actions;
    return (
      <Tooltip content={action.label}>
        <Button icon="plus" size="sm" variant="secondary" fill="text" onClick={() => runAction(action)}>
          {label}
        </Button>
      </Tooltip>
    );
  }

  const menu = (
    <Menu>
      {actions.map((action) => (
        <Menu.Item key={action.id} label={action.label} icon={action.icon} url={action.url} onClick={action.onClick} />
      ))}
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement="bottom-start">
      <Button icon="plus" size="sm" variant="secondary" fill="text">
        {label}
      </Button>
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  sidebar: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  }),
  header: css({
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: theme.spacing(1),
    justifyContent: 'space-between',
    padding: theme.spacing(1, 1, 1, 1.5),
  }),
  search: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(0, 1, 1, 1),
  }),
  body: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(0, 1, 2, 1),
  }),
  scrollArea: css({
    flex: 1,
    minHeight: 0,
  }),
});

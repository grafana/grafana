import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { ToolbarButton } from '@grafana/ui';

import { useQueryLibraryContext } from './QueryLibraryContext';

interface Props {
  datasourceFilters?: string[];
  // Query to save
  query?: DataQuery;
  icon?: string;
  // Callback to load
  onSelectQuery?(query: DataQuery): void;
  tooltip?: string;
}

/**
 * EXPOSED COMPONENT (stable): grafana/open-query-library/v1
 *
 * This component is exposed to plugins via the Plugin Extensions system.
 * Treat its props and user-visible behavior as a stable contract. Do not make
 * breaking changes in-place. If you need to change the API or behavior in a
 * breaking way, create a new versioned component (e.g. v2) and register it
 * under a new ID: "grafana/open-query-library/v2".
 *
 * This component is designed for use by plugins, like Drilldown apps, to add
 * support to save generated queries or load saved queries from the plugin itself
 * or from Explore.
 *
 * Usage from a plugin:
 * ```tsx
 * import { usePluginComponent } from '@grafana/runtime';
 *
 * const { component: OpenQueryLibraryComponent, isLoading } = usePluginComponent(
 *   'grafana/open-query-library/v1'
 * );
 *
 * // Open Query Library to save a query
 *
 * <OpenQueryLibraryComponent
 *   // Data source filter
 *   datasourceFilters={['data-source-name']}
 *   // Query to save
 *   query={query}
 *   icon="save"
 *   tooltip={'Save in Saved Queries'}
 * />
 *
 * // Open Query Library to load a query
 *
 * <OpenQueryLibraryComponent
 *   // Data source filter
 *   datasourceFilters={['data-source-name']}
 *   icon="folder-open"
 *   // Callback to receive the selected query to load
 *   onSelectQuery={onSelectQuery}
 *   tooltip={'Load saved query'}
 * />
 * ```
 */
export const OpenQueryLibraryExposedComponent = ({
  datasourceFilters,
  icon = 'save',
  query,
  onSelectQuery,
  tooltip = t('query-library.exposed-compoment.tooltip', 'Open Query Library'),
}: Props) => {
  const { openDrawer, queryLibraryEnabled } = useQueryLibraryContext();

  const handleClick = useCallback(() => {
    openDrawer({ datasourceFilters, onSelectQuery, query });
    reportInteraction(`exposed_query_library-${onSelectQuery ? 'load-queries-open' : 'save-queries-open'}`);
  }, [datasourceFilters, onSelectQuery, openDrawer, query]);

  if (!queryLibraryEnabled) {
    console.warn(
      '[OpenQueryLibraryExposedComponent]: Attempted to use unsupported exposed component. Query library is not enabled.'
    );
    return null;
  }

  return <ToolbarButton variant="canvas" icon={icon} onClick={handleClick} tooltip={tooltip} />;
};

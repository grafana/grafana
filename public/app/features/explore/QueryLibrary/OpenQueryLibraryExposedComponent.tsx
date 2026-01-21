import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { ToolbarButton } from '@grafana/ui';

import { useQueryLibraryContext } from './QueryLibraryContext';

interface Props {
  datasourceFilters?: string[];
  query?: DataQuery;
  icon?: string;
  onSelectQuery?(query: DataQuery): void;
  tooltip?: string;
}

export const OpenQueryLibraryExposedComponent = ({
  datasourceFilters,
  icon = 'save',
  query,
  onSelectQuery,
  tooltip = t('query-operation.header.save-to-query-library', 'Save query'),
}: Props) => {
  const { openDrawer, queryLibraryEnabled } = useQueryLibraryContext();

  const handleClick = useCallback(() => {
    openDrawer({ datasourceFilters, onSelectQuery, query });
  }, [datasourceFilters, onSelectQuery, openDrawer, query]);

  if (!queryLibraryEnabled) {
    console.warn(
      '[OpenQueryLibraryExposedComponent]: Attempted to use unsupported exposed component. Query library is not enabled.'
    );
    return null;
  }

  return <ToolbarButton variant="canvas" icon={icon} onClick={handleClick} tooltip={tooltip} />;
};

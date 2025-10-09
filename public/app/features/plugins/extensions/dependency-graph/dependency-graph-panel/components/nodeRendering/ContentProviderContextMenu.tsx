/**
 * Content Provider Context Menu
 *
 * Context menu for content provider nodes in the dependency graph.
 */

import React from 'react';

import { t } from '@grafana/i18n';
import { ContextMenu, Menu } from '@grafana/ui';

interface ContentProviderContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  selectedContentProviderId: string | null;
  onClose: () => void;
  onHighlightArrows: () => void;
  onFilter: () => void;
  onRemoveFilter: () => void;
  isFiltered: (providerId: string) => boolean;
}

/**
 * Context menu for content provider nodes
 */
export function ContentProviderContextMenu({
  isOpen,
  position,
  selectedContentProviderId,
  onClose,
  onHighlightArrows,
  onFilter,
  onRemoveFilter,
  isFiltered,
}: ContentProviderContextMenuProps): JSX.Element {
  if (!isOpen || !selectedContentProviderId) {
    return <></>;
  }

  const appName = selectedContentProviderId === 'grafana-core' ? 'Grafana Core' : selectedContentProviderId;

  return (
    <ContextMenu x={position.x} y={position.y} onClose={onClose}>
      <Menu.Item
        label={t('extensions.dependency-graph.highlight-arrows', 'Highlight arrows')}
        onClick={onHighlightArrows}
      />
      <Menu.Item
        label={
          isFiltered(selectedContentProviderId)
            ? t('extensions.dependency-graph.remove-filter', 'Remove filter')
            : t('extensions.dependency-graph.filter-on', 'Filter on {{appName}}', { appName })
        }
        onClick={isFiltered(selectedContentProviderId) ? onRemoveFilter : onFilter}
        icon="filter"
      />
    </ContextMenu>
  );
}

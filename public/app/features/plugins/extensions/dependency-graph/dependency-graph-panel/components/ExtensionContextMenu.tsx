import { t } from '@grafana/i18n';
import { ContextMenu, Menu } from '@grafana/ui';

import { GraphData } from '../types';

interface ExtensionContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  selectedExtensionPointId: string | null;
  data: GraphData;
  onClose: () => void;
  onHighlightArrows: () => void;
  onNavigateToExtensionPoint: () => void;
  onFilterExtensionPoint: () => void;
  onUnfilterExtensionPoint: () => void;
}

/**
 * Context menu component for extension points
 */
export function ExtensionContextMenu({
  isOpen,
  position,
  selectedExtensionPointId,
  data,
  onClose,
  onHighlightArrows,
  onNavigateToExtensionPoint,
  onFilterExtensionPoint,
  onUnfilterExtensionPoint,
}: ExtensionContextMenuProps): JSX.Element | null {
  if (!isOpen || !selectedExtensionPointId) {
    return null;
  }

  const extensionPoint = data.extensionPoints?.find((ep) => ep.id === selectedExtensionPointId);
  if (!extensionPoint) {
    return null;
  }

  // Check if extension point is currently filtered
  const currentUrl = new URL(window.location.href);
  const currentExtensionPoints = currentUrl.searchParams.get('extensionPoints')?.split(',').filter(Boolean) || [];
  const isFiltered = currentExtensionPoints.includes(selectedExtensionPointId);

  return (
    <ContextMenu
      x={position.x}
      y={position.y}
      onClose={onClose}
      renderMenuItems={() => (
        <>
          <Menu.Item
            label={t('extensions.dependency-graph.highlight-connections', 'Highlight connections')}
            icon="arrow-up"
            onClick={onHighlightArrows}
          />
          <Menu.Item
            label={t('extensions.dependency-graph.switch-to-extension-points-view', 'Switch to extension points view')}
            icon="arrow-right"
            onClick={onNavigateToExtensionPoint}
          />
          {isFiltered ? (
            <Menu.Item
              label={t('extensions.dependency-graph.remove-filter', 'Remove filter')}
              icon="filter"
              onClick={onUnfilterExtensionPoint}
            />
          ) : (
            <Menu.Item
              label={t('extensions.dependency-graph.filter-by-extension-point', 'Filter by extension point')}
              icon="filter"
              onClick={onFilterExtensionPoint}
            />
          )}
        </>
      )}
    />
  );
}

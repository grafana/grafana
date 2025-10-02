/**
 * Context Menu Component
 *
 * A context menu that appears on left-click for extension points.
 * Styled to match Grafana UI patterns.
 */

import React, { useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Menu, useTheme2 } from '@grafana/ui';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onExploreExtensionPoint: () => void;
  onHighlightArrows: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  onExploreExtensionPoint,
  onHighlightArrows,
}) => {
  const theme = useTheme2();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && event.target instanceof HTMLElement && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.strong}`,
    borderRadius: theme.shape.borderRadius(1),
    boxShadow: theme.shadows.z3,
    zIndex: 1000,
    minWidth: 200,
    padding: theme.spacing(0.5, 0),
  };

  const menuItemStyle: React.CSSProperties = {
    padding: theme.spacing(1, 2),
    cursor: 'pointer',
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  };

  const menuItemHoverStyle: React.CSSProperties = {
    backgroundColor: theme.colors.action.hover,
  };

  return (
    <div ref={menuRef} style={menuStyle}>
      <Menu>
        <Menu.Item
          label={t('extensions.dependency-graph.explore-extension-point-usage', 'Explore Extension point usage')}
          icon="external-link-alt"
          onClick={() => {
            onExploreExtensionPoint();
            onClose();
          }}
        />
        <Menu.Item
          label={t('extensions.dependency-graph.highlight-associated-arrows', 'Highlight associated arrows')}
          icon="search"
          onClick={() => {
            onHighlightArrows();
            onClose();
          }}
        />
      </Menu>
    </div>
  );
};

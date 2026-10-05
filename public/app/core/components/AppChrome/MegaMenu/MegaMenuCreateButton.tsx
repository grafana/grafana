import { type IconName, type NavModelItem, toIconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Dropdown, Menu } from '@grafana/ui';

import { ITEM_ICONS } from '../QuickAdd/utils';

export interface Props {
  sectionName: string;
  actions: NavModelItem[];
  /** Tells the menu or flyout hosting the button that the user is navigating away */
  onNavigate?: () => void;
  /** Lets a host that closes on hover-out (the rail flyout) stay open while the menu is */
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/** A section's create actions behind a small "New" button, always as a menu so every section behaves the same */
export function MegaMenuCreateButton({ sectionName, actions, onNavigate, onOpenChange, className }: Props) {
  if (actions.length === 0) {
    return null;
  }

  const menu = (
    <Menu>
      {actions.map((action) => (
        <Menu.Item
          key={action.id ?? action.text}
          label={action.text}
          icon={getCreateActionIcon(action)}
          url={action.url}
          onClick={() => {
            reportInteraction('grafana_menu_item_clicked', { url: action.url, from: 'megamenu' });
            onNavigate?.();
          }}
        />
      ))}
    </Menu>
  );

  return (
    <Dropdown
      overlay={menu}
      placement="bottom-start"
      onVisibleChange={(visible) => {
        if (visible) {
          reportInteraction('grafana_create_new_button_menu_opened', { from: 'megamenu' });
        }
        onOpenChange?.(visible);
      }}
    >
      <Button
        className={className}
        icon="plus"
        size="sm"
        variant="secondary"
        fill="text"
        aria-label={t('navigation.megamenu.new-in-section', 'New in {{sectionName}}', {
          sectionName,
          interpolation: { escapeValue: false },
        })}
      >
        {t('navigation.megamenu.new', 'New')}
      </Button>
    </Dropdown>
  );
}

export function getCreateActionIcon(action: NavModelItem): IconName {
  return (action.id && ITEM_ICONS[action.id]) || toIconName(action.icon ?? '') || 'plus';
}

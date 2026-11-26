import { type LinkModel } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Menu } from '../Menu/Menu';
import { type MenuItemProps } from '../Menu/MenuItem';

export function DataLinkMenuItems({ links, variant }: { links: LinkModel[]; variant?: MenuItemProps['variant'] }) {
  return links.map((link, index) => (
    <Menu.Item
      variant={variant}
      key={index}
      label={link.title?.trim() ? link.title : t('grafana-ui.data-link-menu-items.link', 'Link')}
      url={link.href}
      target={link.target}
      icon={link.target === '_blank' ? 'external-link-alt' : 'link'}
      onClick={(event) => {
        if (link.onClick && !(event.ctrlKey || event.metaKey || event.shiftKey)) {
          event.preventDefault();
          link.onClick(event);
        }
      }}
    />
  ));
}

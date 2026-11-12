import { type LinkModel } from '@grafana/data';

import { Menu } from '../Menu/Menu';

export function DataLinkMenuItems({ links }: { links: LinkModel[] }) {
  return links.map((link, index) => (
    <Menu.Item
      key={index}
      label={link.title}
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

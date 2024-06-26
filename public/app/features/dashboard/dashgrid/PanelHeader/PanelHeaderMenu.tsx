import * as React from 'react';

import { PanelMenuItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Menu } from '@grafana/ui';

export interface Props {
  items: PanelMenuItem[];
  style?: React.CSSProperties;
  itemsClassName?: string;
  className?: string;
}

export function PanelHeaderMenu({ items }: Props) {
  const renderItems = (items: PanelMenuItem[]) => {
    function sendEventToParent(data: { type: string; payload: { source: string; value: string } }) {
      window.parent.postMessage(data, '*');
    }
    return items.map((item) => {
      switch (item.type) {
        case 'divider':
          return <Menu.Divider key={item.text} />;
        case 'group':
          return (
            <Menu.Group key={item.text} label={item.text}>
              {item.subMenu ? renderItems(item.subMenu) : undefined}
            </Menu.Group>
          );
        default:
          return (
            <Menu.Item
              key={item.text}
              label={item.text}
              icon={item.iconClassName}
              childItems={item.subMenu ? renderItems(item.subMenu) : undefined}
              url={item.href}
              onClick={(e) => [
                sendEventToParent({
                  type: 'message',
                  payload: { source: 'oodle-grafana', value: item.text.toLowerCase() + 'Panel' },
                }),
                item?.onClick && item?.onClick(e),
              ]}
              shortcut={item.shortcut}
              testId={selectors.components.Panels.Panel.menuItems(item.text)}
            />
          );
      }
    });
  };

  return <Menu>{renderItems(items)}</Menu>;
}

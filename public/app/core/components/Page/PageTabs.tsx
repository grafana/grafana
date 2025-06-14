import { NavModelItem } from '@grafana/data';
import { TabsBar, Tab, toIconName } from '@grafana/ui';

export interface Props {
  navItem: NavModelItem;
}

export function PageTabs({ navItem }: Props) {
  return (
    <TabsBar hideBorder>
      {navItem.children!.map((child, index) => {
        const icon = child.icon ? toIconName(child.icon) : undefined;
        return (
          !child.hideFromTabs && (
            <Tab
              label={child.text}
              active={child.active}
              key={`${child.url}-${index}`}
              icon={icon}
              counter={child.tabCounter}
              href={child.url}
              suffix={child.tabSuffix}
              onChangeTab={child.onClick}
            />
          )
        );
      })}
    </TabsBar>
  );
}

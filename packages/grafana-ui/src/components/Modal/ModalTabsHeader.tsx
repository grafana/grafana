import type { NavModelItem } from '@grafana/data/types';

import { type IconName } from '../../types/icon';
import { Tab } from '../Tabs/Tab';
import { TabsBar } from '../Tabs/TabsBar';

import { ModalHeader } from './ModalHeader';

interface ModalTab {
  value: string;
  label: string;
  icon?: IconName;
  tabSuffix?: NavModelItem['tabSuffix'];
}

interface Props {
  title: string;
  tabs: ModalTab[];
  activeTab: string;
  onChangeTab(tab: ModalTab): void;
}

export const ModalTabsHeader = ({ title, tabs, activeTab, onChangeTab }: Props) => {
  return (
    <ModalHeader title={title}>
      <TabsBar hideBorder={true}>
        {tabs.map((t, index) => {
          return (
            <Tab
              key={`${t.value}-${index}`}
              label={t.label}
              icon={t.icon}
              suffix={t.tabSuffix}
              active={t.value === activeTab}
              onChangeTab={() => onChangeTab(t)}
            />
          );
        })}
      </TabsBar>
    </ModalHeader>
  );
};

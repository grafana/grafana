import React, { useState } from 'react';

import { DataQuery } from '@grafana/data/src/types/query';
import { Drawer, Tab, TabContent, TabsBar } from '@grafana/ui';

import { SavedQuery } from '../api/SavedQueriesApi';

import { ConnectionsTab } from './ConnectionsTab';
import { QueryEditor } from './QueryEditor';
import { QueryEditorDrawerHeader } from './QueryEditorDrawerHeader';
import { VariablesTab } from './VariablesTab';

type Props = {
  onDismiss: () => void;
  savedQuery: SavedQuery<DataQuery>;
};

const initialTabs = [
  {
    label: 'Variables',
    active: true,
  },
  {
    label: 'Connections',
    active: false,
  },
];

export const QueryEditorDrawer = ({ onDismiss, savedQuery }: Props) => {
  const [tabs, setTabs] = useState(initialTabs);

  return (
    <Drawer onClose={onDismiss} width={'40%'} expandable scrollableContent>
      <div>
        <QueryEditorDrawerHeader title={savedQuery.title} />
        <QueryEditor />
        <TabsBar>
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              label={tab.label}
              active={tab.active}
              onChangeTab={() => setTabs(tabs.map((tab, idx) => ({ ...tab, active: idx === index })))}
            />
          ))}
        </TabsBar>
        <TabContent>
          {tabs[0].active && <VariablesTab savedQuery={savedQuery} />}
          {tabs[1].active && <ConnectionsTab />}
        </TabContent>
      </div>
    </Drawer>
  );
};

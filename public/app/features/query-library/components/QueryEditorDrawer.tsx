import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { DataQuery } from '@grafana/data/src/types/query';
import { Drawer, IconName, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';

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
    label: 'Connections',
    active: true,
    icon: 'link',
  },
  {
    label: 'Variables',
    active: false,
    icon: 'info-circle',
  },
  {
    label: 'History',
    active: false,
    icon: 'history',
  },
];

export const QueryEditorDrawer = ({ onDismiss, savedQuery }: Props) => {
  const styles = useStyles2(getStyles);
  const [tabs, setTabs] = useState(initialTabs);

  return (
    <Drawer onClose={onDismiss} width={'40%'} expandable scrollableContent>
      <div>
        <QueryEditorDrawerHeader savedQuery={savedQuery} onDismiss={onDismiss} />
        <div className={styles.queryWrapper}>
          <QueryEditor initialQueries={savedQuery.queries} />
        </div>
        <TabsBar>
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              label={tab.label}
              active={tab.active}
              icon={tab.icon as IconName}
              onChangeTab={() => setTabs(tabs.map((tab, idx) => ({ ...tab, active: idx === index })))}
            />
          ))}
        </TabsBar>
        <TabContent>
          <div className={styles.tabWrapper}>
            {tabs[0].active && <ConnectionsTab savedQuery={savedQuery} />}
            {tabs[1].active && <VariablesTab savedQuery={savedQuery} />}
            {tabs[2].active && <div>TODO History</div>}
          </div>
        </TabContent>
      </div>
    </Drawer>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    queryWrapper: css`
      max-height: calc(50vh);
      overflow-y: scroll;
    `,
    tabWrapper: css`
      overflow-y: scroll;
      max-height: calc(37vh);
    `,
  };
};

import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { DataQuery } from '@grafana/data/src/types/query';
import { Drawer, IconName, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { SavedQuery } from '../api/SavedQueriesApi';

import { HistoryTab } from './HistoryTab';
import { QueryEditor } from './QueryEditor';
import { QueryEditorDrawerHeader } from './QueryEditorDrawerHeader';
import { UsagesTab } from './UsagesTab';
import { VariablesTab } from './VariablesTab';

export type SavedQueryUpdateOpts = { message?: string } & (
  | {
      type: 'create-new';
    }
  | {
      type: 'edit';
    }
);

type Props = {
  onDismiss: () => void;
  savedQuery: SavedQuery<DataQuery>;
  options: SavedQueryUpdateOpts;
};

type tab = {
  label: string;
  active: boolean;
  icon: IconName;
};

const initialTabs: tab[] = [
  {
    label: 'Usages',
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

export const QueryEditorDrawer = (props: Props) => {
  const { onDismiss, options } = props;
  const styles = useStyles2(getStyles);
  const [tabs, setTabs] = useState(initialTabs);
  const [query, setSavedQuery] = useState(props.savedQuery);

  return (
    <Drawer onClose={onDismiss} width={'1000px'} expandable scrollableContent>
      <div>
        <QueryEditorDrawerHeader
          options={options}
          onSavedQueryChange={setSavedQuery}
          savedQuery={query}
          onDismiss={onDismiss}
        />
        <div className={styles.queryWrapper}>
          <QueryEditor onSavedQueryChange={setSavedQuery} savedQuery={query} />
        </div>
        <TabsBar>
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              label={tab.label}
              active={tab.active}
              icon={tab.icon}
              onChangeTab={() => setTabs(tabs.map((tab, idx) => ({ ...tab, active: idx === index })))}
            />
          ))}
        </TabsBar>
        <TabContent>
          <div className={styles.tabWrapper}>
            {tabs[0].active && <UsagesTab savedQuery={query} />}
            {tabs[1].active && <VariablesTab savedQuery={query} options={options} />}
            {tabs[2].active && <HistoryTab />}
          </div>
        </TabContent>
      </div>
    </Drawer>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    queryWrapper: css`
      max-height: calc(60vh);
      overflow-y: scroll;
      margin-bottom: 50px;
    `,
    tabWrapper: css`
      overflow-y: scroll;
      max-height: calc(27vh);
    `,
  };
};

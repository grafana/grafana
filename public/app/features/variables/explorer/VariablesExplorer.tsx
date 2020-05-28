import React, { FC, MouseEvent, useCallback, useState } from 'react';
import { Provider } from 'react-redux';
// @ts-ignore
import { VariableModel } from '../../templating/types';
import { store } from '../../../store/store';
import { VariableIdentifier } from '../state/types';
import { Tab, TabContent, TabsBar } from '@grafana/ui';
import { VariableEditorList } from '../editor/VariableEditorList';
import { VariablesDependencies } from './VariablesDependencies';

interface OwnProps {
  variables: VariableModel[];
  onAddClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  onEditClick: (identifier: VariableIdentifier) => void;
  onChangeVariableOrder: (identifier: VariableIdentifier, fromIndex: number, toIndex: number) => void;
  onDuplicateVariable: (identifier: VariableIdentifier) => void;
  onRemoveVariable: (identifier: VariableIdentifier) => void;
}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

enum VariableTabs {
  Variables = 'variables',
  Dependencies = 'dependencies',
  Usages = 'usages',
}

type TabType = { id: string; text: string; active: boolean };

const UnProvidedVariablesExplorer: FC<Props> = props => {
  const [tabs, setTabs] = useState<TabType[]>([
    { id: VariableTabs.Variables, text: 'Variables', active: true },
    { id: VariableTabs.Dependencies, text: 'Dependencies', active: false },
    { id: VariableTabs.Usages, text: 'Usages', active: false },
  ]);
  const [activeTab, setActiveTab] = useState<TabType>(tabs[0]);

  const onChangeTab = useCallback(
    (tab: TabType) => {
      const newTabs = tabs.map(t => {
        if (t !== tab) {
          return { ...t, active: false };
        }

        setActiveTab(tab);
        return { ...tab, active: true };
      });
      setTabs(newTabs);
    },
    [tabs]
  );

  return (
    <>
      <TabsBar>
        {tabs.map(tab => (
          <Tab
            key={`variables-tab-${tab.text}`}
            label={tab.text}
            onChangeTab={() => onChangeTab(tab)}
            active={tab.active}
          />
        ))}
      </TabsBar>
      <TabContent>
        {activeTab.id === VariableTabs.Variables && <VariableEditorList {...props} />}
        {activeTab.id === VariableTabs.Dependencies && <VariablesDependencies {...props} />}
      </TabContent>
    </>
  );
};

export const VariablesExplorer: FC<Props> = props => (
  <Provider store={store}>
    <UnProvidedVariablesExplorer {...props} />
  </Provider>
);

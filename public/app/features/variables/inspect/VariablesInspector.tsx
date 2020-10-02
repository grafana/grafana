import React, { FC, MouseEvent, useCallback, useState } from 'react';
import { Provider, useSelector } from 'react-redux';
// @ts-ignore
import { VariableModel } from '../../templating/types';
import { store } from '../../../store/store';
import { VariableIdentifier } from '../state/types';
import { Tab, TabContent, TabsBar } from '@grafana/ui';
import { VariableEditorList } from '../editor/VariableEditorList';
import { VariablesDependencies } from './VariablesDependencies';
import { VariablesUnUsed } from './VariablesUnUsed';
import { VariablesUsagesGraph } from './VariablesUsagesGraph';
import { VariablesUnknownGraph } from './VariablesUnknownGraph';
import { StoreState } from '../../../types';

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
  UnUsed = 'unused',
  Unknown = 'unknown',
}

type TabType = { id: string; text: string; active: boolean };

const UnProvidedVariablesInspector: FC<Props> = props => {
  const dashboard = useSelector((state: StoreState) => state.dashboard.getModel());
  const [tabs, setTabs] = useState<TabType[]>([
    { id: VariableTabs.Variables, text: 'List', active: true },
    { id: VariableTabs.Dependencies, text: 'Dependencies', active: false },
    { id: VariableTabs.Usages, text: 'Usages', active: false },
    { id: VariableTabs.UnUsed, text: 'Not used', active: false },
    { id: VariableTabs.Unknown, text: 'Unknown', active: false },
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
        {activeTab.id === VariableTabs.Variables && dashboard && (
          <VariableEditorList {...props} dashboard={dashboard} />
        )}
        {activeTab.id === VariableTabs.Dependencies && <VariablesDependencies {...props} />}
        {activeTab.id === VariableTabs.Usages && <VariablesUsagesGraph {...props} />}
        {activeTab.id === VariableTabs.UnUsed && <VariablesUnUsed {...props} />}
        {activeTab.id === VariableTabs.Unknown && <VariablesUnknownGraph {...props} />}
      </TabContent>
    </>
  );
};

export const VariablesInspector: FC<Props> = props => (
  <Provider store={store}>
    <UnProvidedVariablesInspector {...props} />
  </Provider>
);

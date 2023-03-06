import { css } from '@emotion/css';
import React, { useState, useMemo } from 'react';

import { getBackendSrv } from '@grafana/runtime';
import { Modal, TabContent, TabsBar, Tab, Button } from '@grafana/ui';

import { RuleSettingsArray } from './RuleSettingsArray';
import { RuleSettingsEditor } from './RuleSettingsEditor';
import { RuleTest } from './RuleTest';
import { Rule, RuleType, PipeLineEntitiesInfo, RuleSetting } from './types';
import { getPipeLineEntities } from './utils';

interface Props {
  rule: Rule;
  isOpen: boolean;
  onClose: () => void;
  clickColumn: RuleType;
}
interface TabInfo {
  label: string;
  type?: RuleType;
  isTest?: boolean;
  isConverter?: boolean;
  icon?: string;
}
const tabs: TabInfo[] = [
  { label: 'Converter', type: 'converter', isConverter: true },
  { label: 'Processors', type: 'frameProcessors' },
  { label: 'Outputs', type: 'frameOutputs' },
  { label: 'Test', isTest: true, icon: 'flask' },
];

export const RuleModal = (props: Props) => {
  const { isOpen, onClose, clickColumn } = props;
  const [rule, setRule] = useState<Rule>(props.rule);
  const [activeTab, setActiveTab] = useState<TabInfo | undefined>(tabs.find((t) => t.type === clickColumn));
  // to show color of Save button
  const [hasChange, setChange] = useState<boolean>(false);
  const [ruleSetting, setRuleSetting] = useState<any>(activeTab?.type ? rule?.settings?.[activeTab.type] : undefined);
  const [entitiesInfo, setEntitiesInfo] = useState<PipeLineEntitiesInfo>();

  const onRuleSettingChange = (value: RuleSetting | RuleSetting[]) => {
    setChange(true);
    if (activeTab?.type) {
      setRule({
        ...rule,
        settings: {
          ...rule.settings,
          [activeTab?.type]: value,
        },
      });
    }
    setRuleSetting(value);
  };

  // load pipeline entities info
  useMemo(() => {
    getPipeLineEntities().then((data) => {
      setEntitiesInfo(data);
    });
  }, []);

  const onSave = () => {
    getBackendSrv()
      .put(`api/live/channel-rules`, rule)
      .then(() => {
        setChange(false);
        onClose();
      })
      .catch((e) => console.error(e));
  };

  return (
    <Modal isOpen={isOpen} title={rule.pattern} onDismiss={onClose} closeOnEscape>
      <TabsBar>
        {tabs.map((tab, index) => {
          return (
            <Tab
              key={index}
              label={tab.label}
              active={tab === activeTab}
              icon={tab.icon as any}
              onChangeTab={() => {
                setActiveTab(tab);
                if (tab.type) {
                  // to notify children of the new rule
                  setRuleSetting(rule?.settings?.[tab.type]);
                }
              }}
            />
          );
        })}
      </TabsBar>
      <TabContent>
        {entitiesInfo && rule && activeTab && (
          <>
            {activeTab?.isTest && <RuleTest rule={rule} />}
            {activeTab.isConverter && (
              <RuleSettingsEditor
                onChange={onRuleSettingChange}
                value={ruleSetting}
                ruleType={'converter'}
                entitiesInfo={entitiesInfo}
              />
            )}
            {!activeTab.isConverter && activeTab.type && (
              <RuleSettingsArray
                onChange={onRuleSettingChange}
                value={ruleSetting}
                ruleType={activeTab.type}
                entitiesInfo={entitiesInfo}
              />
            )}
          </>
        )}
        <Button onClick={onSave} className={styles.save} variant={hasChange ? 'primary' : 'secondary'}>
          Save
        </Button>
      </TabContent>
    </Modal>
  );
};

const styles = {
  save: css`
    margin-top: 5px;
  `,
};

import React, { useState, useMemo } from 'react';
import { Modal, TabContent, TabsBar, Tab, Button, useStyles } from '@grafana/ui';
import { Rule, RuleType, PipeLineEntitiesInfo, RuleSetting } from './types';
import { getBackendSrv } from '@grafana/runtime';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { RuleSettingsEditor } from './RuleSettingsEditor';
import { getPipeLineEntities } from './utils';

interface Props {
  rule: Rule;
  isOpen: boolean;
  onClose: () => void;
  clickColumn: RuleType;
}
interface TabType {
  label: string;
  value: RuleType;
}
const tabs: TabType[] = [
  { label: 'Converter', value: 'converter' },
  { label: 'Processor', value: 'processor' },
  { label: 'Output', value: 'output' },
];

export const RuleModal: React.FC<Props> = (props) => {
  const { isOpen, onClose, clickColumn } = props;
  const [rule, setRule] = useState<Rule>(props.rule);
  const [activeTab, setActiveTab] = useState<RuleType>(clickColumn);
  // to show color of Save button
  const [hasChange, setChange] = useState<boolean>(false);
  const [ruleSetting, setRuleSetting] = useState<any>(rule?.settings?.[activeTab]);
  const [entitiesInfo, setEntitiesInfo] = useState<PipeLineEntitiesInfo>();
  const styles = useStyles(getStyles);

  const onRuleSettingChange = (value: RuleSetting) => {
    setChange(true);
    setRule({
      ...rule,
      settings: {
        ...rule.settings,
        [activeTab]: value,
      },
    });
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
              active={tab.value === activeTab}
              onChangeTab={() => {
                setActiveTab(tab.value);
                // to notify children of the new rule
                setRuleSetting(rule?.settings?.[tab.value]);
              }}
            />
          );
        })}
      </TabsBar>
      <TabContent>
        {entitiesInfo && rule && (
          <RuleSettingsEditor
            onChange={onRuleSettingChange}
            value={ruleSetting}
            ruleType={activeTab}
            entitiesInfo={entitiesInfo}
          />
        )}
        <Button onClick={onSave} className={styles.save} variant={hasChange ? 'primary' : 'secondary'}>
          Save
        </Button>
      </TabContent>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    save: css`
      margin-top: 5px;
    `,
  };
};

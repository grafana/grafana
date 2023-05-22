import { css } from '@emotion/css';
import { dump, load } from 'js-yaml';
import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, CodeEditor, Drawer, Icon, Tab, TabsBar, useStyles2, Tooltip } from '@grafana/ui';

import { RulerRuleDTO } from '../../../../../types/unified-alerting-dto';
import { RuleFormValues } from '../../types/rule-form';
import {
  alertingRulerRuleToRuleForm,
  formValuesToRulerRuleDTO,
  recordingRulerRuleToRuleForm,
} from '../../utils/rule-form';
import { isAlertingRulerRule, isRecordingRulerRule } from '../../utils/rules';

interface Props {
  onClose: () => void;
}

const tabs = [{ label: 'Yaml', value: 'yaml' }];

export const RuleInspector = ({ onClose }: Props) => {
  const [activeTab, setActiveTab] = useState('yaml');
  const { setValue } = useFormContext<RuleFormValues>();
  const styles = useStyles2(drawerStyles);

  const onApply = (formValues: RuleFormValues) => {
    // Need to loop through all values and set them individually
    // TODO this is not type-safe :(
    for (const key in formValues) {
      // @ts-ignore
      setValue(key, formValues[key]);
    }
    onClose();
  };

  return (
    <Drawer
      title="Inspect Alert rule"
      subtitle={
        <div className={styles.subtitle}>
          <RuleInspectorSubtitle setActiveTab={setActiveTab} activeTab={activeTab} />
        </div>
      }
      onClose={onClose}
    >
      {activeTab === 'yaml' && <InspectorYamlTab onSubmit={onApply} />}
    </Drawer>
  );
};

interface SubtitleProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const RuleInspectorSubtitle = ({ activeTab, setActiveTab }: SubtitleProps) => {
  return (
    <TabsBar>
      {tabs.map((tab, index) => {
        return (
          <Tab
            key={`${tab.value}-${index}`}
            label={tab.label}
            value={tab.value}
            onChangeTab={() => setActiveTab(tab.value)}
            active={activeTab === tab.value}
          />
        );
      })}
    </TabsBar>
  );
};

interface YamlTabProps {
  onSubmit: (newModel: RuleFormValues) => void;
}

const InspectorYamlTab = ({ onSubmit }: YamlTabProps) => {
  const styles = useStyles2(yamlTabStyle);
  const { getValues } = useFormContext<RuleFormValues>();

  const yamlValues = formValuesToRulerRuleDTO(getValues());
  const [alertRuleAsYaml, setAlertRuleAsYaml] = useState(dump(yamlValues));

  const onApply = () => {
    const rulerRule = load(alertRuleAsYaml) as RulerRuleDTO;
    const currentFormValues = getValues();

    const yamlFormValues = rulerRuleToRuleFormValues(rulerRule);
    onSubmit({ ...currentFormValues, ...yamlFormValues });
  };

  return (
    <>
      <div className={styles.applyButton}>
        <Button type="button" onClick={onApply}>
          Apply
        </Button>
        <Tooltip content={<YamlContentInfo />} theme="info" placement="left-start" interactive={true}>
          <Icon name="exclamation-triangle" size="xl" />
        </Tooltip>
      </div>

      <div className={styles.content}>
        <AutoSizer disableWidth>
          {({ height }) => (
            <CodeEditor
              width="100%"
              height={height}
              language="yaml"
              value={alertRuleAsYaml}
              onBlur={setAlertRuleAsYaml}
              monacoOptions={{
                minimap: {
                  enabled: false,
                },
              }}
            />
          )}
        </AutoSizer>
      </div>
    </>
  );
};

function YamlContentInfo() {
  return (
    <div>
      The YAML content in the editor only contains alert rule configuration <br />
      To configure Prometheus, you need to provide the rest of the{' '}
      <a
        href="https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/"
        target="_blank"
        rel="noreferrer"
      >
        configuration file content.
      </a>
    </div>
  );
}

function rulerRuleToRuleFormValues(rulerRule: RulerRuleDTO): Partial<RuleFormValues> {
  if (isAlertingRulerRule(rulerRule)) {
    return alertingRulerRuleToRuleForm(rulerRule);
  } else if (isRecordingRulerRule(rulerRule)) {
    return recordingRulerRuleToRuleForm(rulerRule);
  }

  return {};
}

const yamlTabStyle = (theme: GrafanaTheme2) => ({
  content: css`
    flex-grow: 1;
    height: 100%;
    padding-bottom: 16px;
    margin-bottom: ${theme.spacing(2)};
  `,
  applyButton: css`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    flex-grow: 0;
    margin-bottom: ${theme.spacing(2)};
  `,
});

const drawerStyles = () => ({
  subtitle: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
});

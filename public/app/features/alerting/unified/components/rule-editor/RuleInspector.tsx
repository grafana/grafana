import { css } from '@emotion/css';
import { dump, load } from 'js-yaml';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, CodeEditor, Drawer, Icon, Tab, TabsBar, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { RulerRuleDTO } from '../../../../../types/unified-alerting-dto';
import { RuleFormValues } from '../../types/rule-form';
import {
  alertingRulerRuleToRuleForm,
  formValuesToRulerRuleDTO,
  recordingRulerRuleToRuleForm,
} from '../../utils/rule-form';
import { rulerRuleType } from '../../utils/rules';

interface Props {
  onClose: () => void;
}

const cloudRulesTabs = [{ label: 'Yaml', value: 'yaml' }];

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
      title={t('alerting.rule-inspector.title-inspect-alert-rule', 'Inspect Alert rule')}
      subtitle={
        <div className={styles.subtitle}>
          <RuleInspectorTabs tabs={cloudRulesTabs} setActiveTab={setActiveTab} activeTab={activeTab} />
        </div>
      }
      onClose={onClose}
    >
      {activeTab === 'yaml' && <InspectorYamlTab onSubmit={onApply} />}
    </Drawer>
  );
};

interface RuleInspectorTabsProps<T = string> {
  tabs: Array<{ label: string; value: T }>;
  activeTab: T;
  setActiveTab: (tab: T) => void;
}

export function RuleInspectorTabs<T extends string>({ tabs, activeTab, setActiveTab }: RuleInspectorTabsProps<T>) {
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
}

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
          <Trans i18nKey="alerting.inspector-yaml-tab.apply">Apply</Trans>
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
      <Trans i18nKey="alerting.yaml-content-info.body">
        The YAML content in the editor only contains alert rule configuration <br />
        To configure Prometheus, you need to provide the rest of the{' '}
        <TextLink href="https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/" external>
          configuration file content.
        </TextLink>
      </Trans>
    </div>
  );
}

function rulerRuleToRuleFormValues(rulerRule: RulerRuleDTO): Partial<RuleFormValues> {
  if (rulerRuleType.dataSource.alertingRule(rulerRule)) {
    return alertingRulerRuleToRuleForm(rulerRule);
  } else if (rulerRuleType.dataSource.recordingRule(rulerRule)) {
    return recordingRulerRuleToRuleForm(rulerRule);
  }

  return {};
}

export const yamlTabStyle = (theme: GrafanaTheme2) => ({
  content: css({
    flexGrow: 1,
    height: '100%',
    paddingBottom: '16px',
    marginBottom: theme.spacing(2),
  }),
  applyButton: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexGrow: 0,
    marginBottom: theme.spacing(2),
  }),
});

export const drawerStyles = () => ({
  subtitle: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }),
});

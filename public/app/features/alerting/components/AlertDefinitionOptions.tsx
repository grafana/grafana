import React, { FC, FormEvent, useState } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Field, Input, Tab, TabContent, TabsBar, TextArea, useStyles } from '@grafana/ui';
import { AlertDefinition, NotificationChannelType } from 'app/types';

interface Props {
  alertDefinition: AlertDefinition;
  notificationChannelTypes: NotificationChannelType[];
  onChange: (event: FormEvent) => void;
}

enum Tabs {
  Alert = 'alert',
  Panel = 'panel',
}

const tabs = [
  { id: Tabs.Alert, text: 'Alert definition' },
  { id: Tabs.Panel, text: 'Panel' },
];

export const AlertDefinitionOptions: FC<Props> = ({ alertDefinition, onChange }) => {
  const styles = useStyles(getStyles);
  const [activeTab, setActiveTab] = useState<string>(Tabs.Alert);

  return (
    <div className={styles.container}>
      <TabsBar>
        {tabs.map((tab, index) => (
          <Tab
            key={`${tab.id}-${index}`}
            label={tab.text}
            active={tab.id === activeTab}
            onChangeTab={() => setActiveTab(tab.id)}
          />
        ))}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {activeTab === Tabs.Alert && (
          <div>
            <Field label="Name">
              <Input width={25} name="name" value={alertDefinition.name} onChange={onChange} />
            </Field>
            <Field label="Description" description="What does the alert do and why was it created">
              <TextArea
                rows={5}
                width={25}
                name="description"
                value={alertDefinition.description}
                onChange={onChange}
              />
            </Field>
            <Field label="Evaluate">
              <span>Every For</span>
            </Field>
            <Field label="Conditions">
              <div></div>
            </Field>
          </div>
        )}
        {activeTab === Tabs.Panel && <div>VizPicker</div>}
      </TabContent>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      margin-top: ${theme.spacing.md};
      height: 100%;
    `,
    tabContent: css`
      background: ${theme.colors.panelBg};
      height: 100%;
    `,
  };
};

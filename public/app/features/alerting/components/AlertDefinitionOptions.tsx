import React, { FC, FormEvent } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Field, Input, Select, TextArea, useStyles } from '@grafana/ui';
import { AlertDefinition, NotificationChannelType } from 'app/types';
import { mapChannelsToSelectableValue } from '../utils/notificationChannels';

interface Props {
  alertDefinition: AlertDefinition;
  notificationChannelTypes: NotificationChannelType[];
  onChange: (event: FormEvent) => void;
}

export const AlertDefinitionOptions: FC<Props> = ({ alertDefinition, notificationChannelTypes, onChange }) => {
  const styles = useStyles(getStyles);

  return (
    <div style={{ paddingTop: '16px' }}>
      <div className={styles.container}>
        <h4>Alert definition</h4>
        <Field label="Name">
          <Input width={25} name="name" value={alertDefinition.name} onChange={onChange} />
        </Field>
        <Field label="Description" description="What does the alert do and why was it created">
          <TextArea rows={5} width={25} name="description" value={alertDefinition.description} onChange={onChange} />
        </Field>
        <Field label="Evaluate">
          <span>Every For</span>
        </Field>
        <Field label="Conditions">
          <div></div>
        </Field>
        {notificationChannelTypes.length > 0 && (
          <>
            <Field label="Notification channel">
              <Select options={mapChannelsToSelectableValue(notificationChannelTypes, false)} onChange={onChange} />
            </Field>
          </>
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    wrapper: css`
      padding-top: ${theme.spacing.md};
    `,
    container: css`
      padding: ${theme.spacing.md};
      background-color: ${theme.colors.panelBg};
    `,
  };
};

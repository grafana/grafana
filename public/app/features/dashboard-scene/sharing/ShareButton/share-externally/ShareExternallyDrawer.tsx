import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';
import { Alert, Label, Stack, Text } from '@grafana/ui';
import { Select, useStyles2 } from '@grafana/ui/';

import { DashboardScene } from '../../../scene/DashboardScene';

export interface ShareExternallyDrawerState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

export class ShareExternallyDrawer extends SceneObjectBase<ShareExternallyDrawerState> {
  static Component = ShareExternallyDrawerRenderer;

  constructor(state: ShareExternallyDrawerState) {
    super(state);
  }
}

const EMAIL_SHARING_URL = 'https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/#email-sharing';

function ShareExternallyDrawerRenderer({ model }: SceneComponentProps<ShareExternallyDrawer>) {
  const [value, setValue] = React.useState<SelectableValue<string>>();
  const styles = useStyles2(getStyles);

  const options = [
    { label: 'Only specific people', value: 'email', icon: 'users-alt' },
    { label: 'Anyone with the link', value: 'public', icon: 'globe' },
  ];

  return (
    <Stack direction="column" gap={2}>
      <Label description="Only people with access can open with the link">Link access</Label>
      <Stack direction="row" gap={1} alignItems="center">
        <Select
          options={options}
          value={value}
          onChange={(v) => {
            setValue(v);
          }}
          defaultValue={options[0]}
          className={styles.select}
        />
        <Text element="p" variant="bodySmall" color="disabled">
          can access
        </Text>
      </Stack>
      <Alert
        title=""
        severity="info"
        buttonContent={<span>Learn more</span>}
        onRemove={() => window.open(EMAIL_SHARING_URL, '_blank')}
      >
        Effective immediately, sharing public dashboards by email incurs a cost per active user. Going forward, you’ll
        be prompted for payment whenever you add new users to your dashboard.
      </Alert>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    select: css({
      flex: 1,
    }),
  };
};

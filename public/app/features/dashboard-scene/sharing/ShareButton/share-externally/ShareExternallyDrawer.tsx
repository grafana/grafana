import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';
import { Label, Stack, Text } from '@grafana/ui';
import { Select, useStyles2 } from '@grafana/ui/';
import { PublicDashboardShareType } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';

import { DashboardScene } from '../../../scene/DashboardScene';

import { EmailSharingConfig } from './EmailSharingConfig';

export interface ShareExternallyDrawerState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

export class ShareExternallyDrawer extends SceneObjectBase<ShareExternallyDrawerState> {
  static Component = ShareExternallyDrawerRenderer;

  constructor(state: ShareExternallyDrawerState) {
    super(state);
  }
}

const options = [
  { label: 'Only specific people', value: PublicDashboardShareType.EMAIL, icon: 'users-alt' },
  { label: 'Anyone with the link', value: PublicDashboardShareType.PUBLIC, icon: 'globe' },
];

function ShareExternallyDrawerRenderer({ model }: SceneComponentProps<ShareExternallyDrawer>) {
  const [value, setValue] = React.useState<SelectableValue<PublicDashboardShareType>>(options[0]);
  const styles = useStyles2(getStyles);

  const onCancel = () => {
    model.state.dashboardRef.resolve().closeModal();
  };

  return (
    <Stack direction="column" gap={2}>
      <div>
        <Label description="Only people with access can open with the link">Link access</Label>
        <Stack direction="row" gap={1} alignItems="center">
          <Select
            options={options}
            value={value}
            onChange={(v) => {
              setValue(v);
            }}
            className={styles.select}
          />
          <Text element="p" variant="bodySmall" color="disabled">
            can access
          </Text>
        </Stack>
      </div>
      {value.value === PublicDashboardShareType.EMAIL && <EmailSharingConfig onCancel={onCancel} />}
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

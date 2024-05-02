import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { config, featureEnabled } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';
import { Label, Stack, Text } from '@grafana/ui';
import { Select, useStyles2 } from '@grafana/ui/';
import { PublicDashboardShareType } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';

import { DashboardScene } from '../../../scene/DashboardScene';

import { EmailSharing } from './EmailShare/EmailSharing';
import { PublicConfiguration } from './PublicShare/PublicConfiguration';

export interface ShareExternallyDrawerState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

export class ShareExternallyDrawer extends SceneObjectBase<ShareExternallyDrawerState> {
  static Component = ShareExternallyDrawerRenderer;

  constructor(state: ShareExternallyDrawerState) {
    super(state);
  }
}

const hasEmailSharingEnabled =
  !!config.featureToggles.publicDashboardsEmailSharing && featureEnabled('publicDashboardsEmailSharing');

const options = [{ label: 'Anyone with the link', value: PublicDashboardShareType.PUBLIC, icon: 'globe' }];

if (hasEmailSharingEnabled) {
  options.unshift({ label: 'Only specific people', value: PublicDashboardShareType.EMAIL, icon: 'users-alt' });
}

function ShareExternallyDrawerRenderer({ model }: SceneComponentProps<ShareExternallyDrawer>) {
  const [value, setValue] = React.useState<SelectableValue<PublicDashboardShareType>>(options[0]);
  const styles = useStyles2(getStyles);

  const dashboard = model.state.dashboardRef.resolve();

  const onCancel = () => {
    dashboard.closeModal();
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
      {hasEmailSharingEnabled && value.value === PublicDashboardShareType.EMAIL && (
        <EmailSharing dashboard={dashboard} onCancel={onCancel} />
      )}
      {value.value === PublicDashboardShareType.PUBLIC && <PublicConfiguration onCancel={onCancel} />}
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

import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Label, Select, Stack, Text, useStyles2 } from '@grafana/ui';
import { publicDashboardApi, useUpdatePublicDashboardMutation } from 'app/features/dashboard/api/publicDashboardApi';
import { PublicDashboardShareType } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

export default function ShareTypeSelect({
  dashboard,
  setShareType,
  options,
  value,
}: {
  dashboard: DashboardScene;
  setShareType: (v: SelectableValue<PublicDashboardShareType>) => void;
  value: SelectableValue<PublicDashboardShareType>;
  options: Array<{ label: string; value: PublicDashboardShareType }>;
}) {
  const { data: publicDashboard } = publicDashboardApi.endpoints?.getPublicDashboard.useQueryState(
    dashboard.state.uid!
  );
  const [updateShareType] = useUpdatePublicDashboardMutation();

  const styles = useStyles2(getStyles);

  const onUpdateShareType = (shareType: PublicDashboardShareType) => {
    if (!publicDashboard) {
      return;
    }

    DashboardInteractions.publicDashboardShareTypeChange({
      shareType: shareType === PublicDashboardShareType.EMAIL ? 'email' : 'public',
    });

    const req = {
      dashboard,
      payload: {
        ...publicDashboard!,
        share: shareType,
      },
    };

    updateShareType(req);
  };

  return (
    <div>
      <Label description="Only people with access can open with the link">Link access</Label>
      <Stack direction="row" gap={1} alignItems="center">
        <Select
          options={options}
          value={value}
          onChange={(v) => {
            setShareType(v);
            onUpdateShareType(v.value!);
          }}
          className={styles.select}
        />
        <Text element="p" variant="bodySmall" color="disabled">
          can access
        </Text>
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    select: css({
      flex: 1,
    }),
  };
};

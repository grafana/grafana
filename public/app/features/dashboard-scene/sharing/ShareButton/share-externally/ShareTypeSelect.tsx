import { css } from '@emotion/css';
import React from 'react';

import { SelectableValue, toIconName } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Icon, Label, Select, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { publicDashboardApi, useUpdatePublicDashboardMutation } from 'app/features/dashboard/api/publicDashboardApi';
import {
  isEmailSharingEnabled,
  PublicDashboardShareType,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { AccessControlAction } from 'app/types';

import { ANYONE_WITH_THE_LINK_SHARE_OPTION } from './ShareExternally';

const selectors = e2eSelectors.pages.ShareDashboardDrawer.ShareExternally;
export default function ShareTypeSelect({
  dashboard,
  setShareType,
  options,
  value,
}: {
  dashboard: DashboardScene;
  setShareType: (v: SelectableValue<PublicDashboardShareType>) => void;
  value: SelectableValue<PublicDashboardShareType>;
  options: Array<SelectableValue<PublicDashboardShareType>>;
}) {
  const styles = useStyles2(getStyles);
  const { data: publicDashboard } = publicDashboardApi.endpoints?.getPublicDashboard.useQueryState(
    dashboard.state.uid!
  );
  const [updateShareType, { isLoading }] = useUpdatePublicDashboardMutation();

  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);

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
      <Stack justifyContent="space-between">
        <Label description={value.description}>Link access</Label>
        {isLoading && <Spinner />}
      </Stack>
      <Stack direction="row" gap={1} alignItems="center">
        {isEmailSharingEnabled ? (
          <Select
            data-testid={selectors.shareTypeSelect}
            options={options}
            value={value}
            disabled={!hasWritePermissions}
            onChange={(v) => {
              setShareType(v);
              onUpdateShareType(v.value!);
            }}
            className={styles.select}
          />
        ) : (
          <>
            {toIconName(ANYONE_WITH_THE_LINK_SHARE_OPTION.icon) && (
              <Icon name={toIconName(ANYONE_WITH_THE_LINK_SHARE_OPTION.icon)!} />
            )}
            <Text>{ANYONE_WITH_THE_LINK_SHARE_OPTION.label}</Text>
          </>
        )}
        <Text element="p" variant="bodySmall" color="disabled">
          can access
        </Text>
      </Stack>
    </div>
  );
}

const getStyles = () => {
  return {
    select: css({
      flex: 1,
    }),
  };
};

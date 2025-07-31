import { css } from '@emotion/css';

import { SelectableValue, toIconName } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { Icon, Label, Select, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import {
  publicDashboardApi,
  useUpdatePublicDashboardAccessMutation,
} from 'app/features/dashboard/api/publicDashboardApi';
import {
  isEmailSharingEnabled,
  PublicDashboardShareType,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { AccessControlAction } from 'app/types/accessControl';

import { useShareDrawerContext } from '../../ShareDrawer/ShareDrawerContext';

import { getAnyOneWithTheLinkShareOption } from './utils';

const selectors = e2eSelectors.pages.ShareDashboardDrawer.ShareExternally;
export default function ShareTypeSelect({
  setShareType,
  options,
  value,
}: {
  setShareType: (v: SelectableValue<PublicDashboardShareType>) => void;
  value: SelectableValue<PublicDashboardShareType>;
  options: Array<SelectableValue<PublicDashboardShareType>>;
}) {
  const { dashboard } = useShareDrawerContext();
  const styles = useStyles2(getStyles);

  const { data: publicDashboard } = publicDashboardApi.endpoints?.getPublicDashboard.useQueryState(
    dashboard.state.uid!
  );
  const [updateAccess, { isLoading }] = useUpdatePublicDashboardAccessMutation();

  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);
  const anyOneWithTheLinkOpt = getAnyOneWithTheLinkShareOption();

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

    updateAccess(req);
  };

  return (
    <div>
      <Stack justifyContent="space-between">
        <Label description={value.description}>
          <Trans i18nKey="public-dashboard.share-configuration.share-type-label">Link access</Trans>
        </Label>
        {isLoading && <Spinner />}
      </Stack>
      {isEmailSharingEnabled() ? (
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
        <Stack gap={1} alignItems="center">
          {toIconName(anyOneWithTheLinkOpt.icon) && <Icon name={toIconName(anyOneWithTheLinkOpt.icon)!} />}
          <Text>{anyOneWithTheLinkOpt.label}</Text>
        </Stack>
      )}
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

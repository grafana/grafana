import { Tooltip, Button, Stack } from '@grafana/ui';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { Trans } from 'app/core/internationalization';

type VersionsButtonsType = {
  hasMore: boolean;
  canCompare: boolean;
  getVersions: (append: boolean) => void;
  getDiff: () => void;
  isLastPage: boolean;
};
export const VersionsHistoryButtons = ({
  hasMore,
  canCompare,
  getVersions,
  getDiff,
  isLastPage,
}: VersionsButtonsType) => (
  <Stack>
    {hasMore && (
      <Button
        type="button"
        onClick={() => {
          getVersions(true);
          DashboardInteractions.showMoreVersionsClicked();
        }}
        variant="secondary"
        disabled={isLastPage}
      >
        {/* BMC Change: Next line */}
        <Trans i18nKey={'bmcgrafana.dashboards.settings.versions.buttons.more-versions'}>Show more versions</Trans>
      </Button>
    )}
    <Tooltip content="Select two versions to start comparing" placement="bottom">
      <Button type="button" disabled={!canCompare} onClick={getDiff} icon="code-branch">
        {/* BMC Change: Next line */}
        <Trans i18nKey={'bmcgrafana.dashboards.settings.versions.buttons.compare-versions'}>Compare versions</Trans>
      </Button>
    </Tooltip>
  </Stack>
);

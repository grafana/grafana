import { Trans, t } from '@grafana/i18n';
import { Tooltip, Button, Stack } from '@grafana/ui';

type VersionsButtonsType = {
  canCompare: boolean;
  getDiff: () => void;
};
export const VersionsHistoryButtons = ({ canCompare, getDiff }: VersionsButtonsType) => {
  return (
    <Stack>
      <Tooltip
        content={t(
          'dashboard-scene.versions-history-buttons.content-select-two-versions-to-start-comparing',
          'Select two versions to start comparing'
        )}
        placement="bottom"
      >
        <Button type="button" disabled={!canCompare} onClick={getDiff} icon="code-branch">
          <Trans i18nKey="dashboard-scene.versions-history-buttons.compare-versions">Compare versions</Trans>
        </Button>
      </Tooltip>
    </Stack>
  );
};

import { Trans } from '@grafana/i18n';
import { Button } from '@grafana/ui';

export type SaveTarget = 'repository' | 'database';

export function SaveTargetSwitch({ target, onChange }: { target: SaveTarget; onChange: (target: SaveTarget) => void }) {
  // The wrapper keeps the text button from stretching to the drawer width
  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        fill="text"
        onClick={() => onChange(target === 'repository' ? 'database' : 'repository')}
      >
        {target === 'repository' ? (
          <Trans i18nKey="dashboard-scene.save-dashboard-drawer.save-to-database">
            Save to Grafana database instead
          </Trans>
        ) : (
          <Trans i18nKey="dashboard-scene.save-dashboard-drawer.save-to-git">Save to Git repository instead</Trans>
        )}
      </Button>
    </div>
  );
}

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button } from '@grafana/ui';

export type SaveTarget = 'repository' | 'database';
export type SaveTargetResource = 'dashboard' | 'folder';

interface Props {
  target: SaveTarget;
  onChange: (target: SaveTarget) => void;
  /** Picks the copy. The dashboard save drawer is the original caller, so it stays the default */
  resource?: SaveTargetResource;
}

export function SaveTargetSwitch({ target, onChange, resource = 'dashboard' }: Props) {
  const next: SaveTarget = target === 'repository' ? 'database' : 'repository';

  // The dashboard keys keep their original namespace so their existing translations survive
  const labels: Record<`${SaveTargetResource}:${SaveTarget}`, string> = {
    'dashboard:repository': t('dashboard-scene.save-dashboard-drawer.save-to-git', 'Save to Git repository instead'),
    'dashboard:database': t(
      'dashboard-scene.save-dashboard-drawer.save-to-database',
      'Save to Grafana database instead'
    ),
    'folder:repository': t('provisioning.save-target-switch.create-in-git', 'Create in Git repository instead'),
    'folder:database': t('provisioning.save-target-switch.create-in-database', 'Create in Grafana database instead'),
  };

  // Reported here rather than per caller, so every surface offering the choice is measured the same
  const handleClick = () => {
    reportInteraction('grafana_provisioning_save_target_changed', { resource, target: next });
    onChange(next);
  };

  // The wrapper keeps the text button from stretching to the drawer width
  return (
    <div>
      <Button variant="secondary" size="sm" fill="text" onClick={handleClick}>
        {labels[`${resource}:${next}`]}
      </Button>
    </div>
  );
}

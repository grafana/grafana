import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { PlanBuildingOverlay } from './PlanBuildingOverlay';

/**
 * The building screen over a template the Assistant is turning into a draft (see templateAdoption.ts).
 * It covers the dashboard's controls, body and sidebar; the template stays mounted underneath, so it
 * loads, renders and reports as it does uncovered.
 */
export function TemplateAdoptionCover({ startedAt }: { startedAt: number }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.cover} data-testid="dashboard-template-adoption-cover">
      <PlanBuildingOverlay startedAt={startedAt} />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    cover: css({
      position: 'absolute',
      inset: 0,
      zIndex: theme.zIndex.navbarFixed,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      background: theme.colors.background.canvas,
    }),
  };
}

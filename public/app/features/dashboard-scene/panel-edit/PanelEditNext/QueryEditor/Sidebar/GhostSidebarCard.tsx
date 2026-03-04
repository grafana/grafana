import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { ActionItem } from '../../Actions';
import { QueryEditorType, SIDEBAR_CARD_SPACING } from '../../constants';

import { SidebarCard } from './SidebarCard';

interface GhostSidebarCardProps {
  id: string;
  type: QueryEditorType;
}

export function GhostSidebarCard({ id, type }: GhostSidebarCardProps) {
  const styles = useStyles2(getStyles);
  const item: ActionItem = { name: '', type, isHidden: false };

  return (
    <div className={styles.wrapper}>
      <SidebarCard id={id} isSelected={false} item={item} onClick={() => {}} variant="ghost">
        {null}
      </SidebarCard>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({ marginTop: theme.spacing(SIDEBAR_CARD_SPACING) }),
});

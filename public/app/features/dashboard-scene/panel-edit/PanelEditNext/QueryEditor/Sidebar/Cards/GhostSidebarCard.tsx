import { ActionItem } from '../../../Actions';
import { QueryEditorType } from '../../../constants';

import { SidebarCard } from './SidebarCard';

interface GhostSidebarCardProps {
  id: string;
  type: QueryEditorType;
}

export function GhostSidebarCard({ id, type }: GhostSidebarCardProps) {
  const item: ActionItem = { name: '', type, isHidden: false };

  return (
    <SidebarCard id={id} isSelected={false} item={item} onClick={() => {}} variant="ghost">
      {null}
    </SidebarCard>
  );
}

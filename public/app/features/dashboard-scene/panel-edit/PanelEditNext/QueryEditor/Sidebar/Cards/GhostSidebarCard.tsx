import { type ActionItem } from '../../../actionItem';
import { type QueryEditorType } from '../../../constants';

import { SidebarCard } from './SidebarCard';

interface GhostSidebarCardProps {
  id: string;
  type: QueryEditorType;
}

export function GhostSidebarCard({ id, type }: GhostSidebarCardProps) {
  const item: ActionItem = { id, type, isHidden: false };

  return (
    <SidebarCard id={id} isSelected={false} item={item} onSelect={() => {}} variant="ghost">
      {null}
    </SidebarCard>
  );
}

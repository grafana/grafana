import { useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { getStarsSrv } from '@grafana/runtime';
import { Icon, ToolbarButton } from '@grafana/ui';

import { itemStarred } from './analytics/main';
import { useStarredItems } from './hooks';

const getStarTooltips = (title: string) => ({
  star: t('stars.mark-as-starred', 'Mark as favorite'),
  starWithTitle: t('stars.mark-as-starred-with-title', 'Mark "{{title}}" as favorite', { title }),
  unstar: t('stars.unmark-as-starred', 'Unmark as favorite'),
  unstarWithTitle: t('stars.unmark-as-starred-with-title', 'Unmark "{{title}}" as favorite', { title }),
});

type Props = {
  title: string;
  group: string;
  kind: string;
  id: string;
  onStarChange?: (id: string, isStarred: boolean) => void;
};

export function StarToolbarButton({ title, group, kind, id, onStarChange }: Props) {
  const tooltips = getStarTooltips(title);

  const { data: stars, isLoading } = useStarredItems(group, kind);

  const isStarred = useMemo(() => {
    const starredItems = stars || [];

    return starredItems.includes(id);
  }, [id, stars]);

  const handleStarToggle = async () => {
    const ref = { group, kind, id, title };
    try {
      await (isStarred ? getStarsSrv().unstar(ref) : getStarsSrv().star(ref));
    } catch {
      // Grafana refused the change — the button keeps showing the state that persisted
      return;
    }
    onStarChange?.(id, !isStarred);
    itemStarred({
      group,
      kind,
      status: !isStarred ? 'starred' : 'unstarred',
      origin: 'StarToolbarButton',
    });
  };

  const iconProps = useMemo(() => {
    if (isLoading) {
      return { name: 'spinner', type: 'default' } as const;
    }
    if (isStarred) {
      return { name: 'favorite', type: 'mono' } as const;
    }
    return { name: 'star', type: 'default' } as const;
  }, [isLoading, isStarred]);

  const tooltipAndLabel = (() => {
    return isStarred
      ? { tooltip: tooltips.unstar, label: isLoading ? undefined : tooltips.unstarWithTitle }
      : { tooltip: tooltips.star, label: isLoading ? undefined : tooltips.starWithTitle };
  })();

  const icon = <Icon {...iconProps} size="lg" key={`${isLoading}-${isStarred}`} />;
  return (
    <ToolbarButton
      disabled={isLoading}
      tooltip={tooltipAndLabel.tooltip}
      aria-label={tooltipAndLabel.label}
      aria-pressed={isStarred}
      icon={icon}
      data-testid={selectors.components.NavToolbar.markAsFavorite}
      onClick={handleStarToggle}
    />
  );
}

/**
 * Props are widened because the registry types every exposed component as `ComponentType<{}>`;
 * the contract is only checked on the consuming side, through `usePluginComponent`'s generic.
 * A plugin that names no object has nothing to star, so this renders nothing rather than
 * throwing out of someone else's React tree.
 */
export function StarToolbarButtonExposed(props: Partial<Props>) {
  const { title, group, kind, id } = props;
  if (!title || !group || !kind || !id) {
    return null;
  }
  return <StarToolbarButton {...props} title={title} group={group} kind={kind} id={id} />;
}

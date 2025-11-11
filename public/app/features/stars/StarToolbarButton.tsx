import { useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Icon, ToolbarButton } from '@grafana/ui';

import { useStarItem, useStarredItems } from './hooks';

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

  const handleItemStar = useStarItem(group, kind);

  const { data: stars, isLoading } = useStarredItems(group, kind);

  const isStarred = useMemo(() => {
    const starredItems = stars || [];

    return starredItems.includes(id);
  }, [id, stars]);

  const handleStarToggle = async () => {
    await handleItemStar({ id, title }, !isStarred);
    onStarChange?.(id, !isStarred);
  };

  const iconProps = (() => {
    if (isLoading) {
      return { name: 'spinner', type: 'default' } as const;
    }
    if (isStarred) {
      return { name: 'favorite', type: 'mono' } as const;
    }
    return { name: 'star', type: 'default' } as const;
  })();

  const tooltipAndLabel = (() => {
    if (isLoading) {
      return {};
    }
    return isStarred
      ? { tooltip: tooltips.unstar, label: tooltips.unstarWithTitle }
      : { tooltip: tooltips.star, label: tooltips.starWithTitle };
  })();

  const icon = <Icon {...iconProps} size="lg" />;
  return (
    <ToolbarButton
      disabled={isLoading}
      tooltip={tooltipAndLabel.tooltip}
      aria-label={tooltipAndLabel.label}
      icon={icon}
      data-testid={selectors.components.NavToolbar.markAsFavorite}
      onClick={handleStarToggle}
    />
  );
}

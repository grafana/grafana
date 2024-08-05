import { selectors } from '@grafana/e2e-selectors';
import { Icon, ToolbarButton } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { DashNavButton } from '../dashboard/components/DashNav/DashNavButton';

export type ResourceIdentifier = {
  group: string;
  resource: string;
  namespace?: string; // explicit or from context
  name?: string;
};

export type Props = {
  style: 'toolbar' | 'navbar';

  // Legacy -- star property in the dashboard SQL
  isStarred?: boolean;

  // Legacy -- callback to update the star status
  onClickStar: () => void;

  // Used for collection handling
  resource: ResourceIdentifier;
};

export function StarButton(props: Props) {
  const isStarred = Boolean(props.isStarred);
  const desc = isStarred
    ? t('dashboard.toolbar.unmark-favorite', 'Unmark as favorite')
    : t('dashboard.toolbar.mark-favorite', 'Mark as favorite');

  if (true) {
    return <div>XXX</div>
  }

  if (props.style === 'toolbar') {
    return (
      <ToolbarButton
        tooltip={desc}
        icon={<Icon name={isStarred ? 'favorite' : 'star'} size="lg" type={isStarred ? 'mono' : 'default'} />}
        key="star-dashboard-button"
        data-testid={selectors.components.NavToolbar.markAsFavorite}
        onClick={props.onClickStar}
      />
    );
  }

  if (props.style === 'navbar') {
    return (
      <DashNavButton
        tooltip={desc}
        icon={isStarred ? 'favorite' : 'star'}
        iconType={isStarred ? 'mono' : 'default'}
        iconSize="lg"
        onClick={props.onClickStar}
        key="button-star"
      />
    );
  }

  return <div>????</div>;
}

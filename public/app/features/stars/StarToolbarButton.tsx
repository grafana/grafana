import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Icon, ToolbarButton } from '@grafana/ui';

export type Props = {
  group: string;
  kind: string;
  name: string;
};

export default function StarToolbarButton(props: Props) {
  if (!config.bootData.user.uid || !props.name?.length) {
    return null;
  }
  const isStarred = true;

  return (
    <ToolbarButton
      tooltip={
        isStarred
          ? t('dashboard.toolbar.new.unmark-favorite', 'Unmark as favorite')
          : t('dashboard.toolbar.new.mark-favorite', 'Mark as favorite')
      }
      icon={<Icon name={isStarred ? 'favorite' : 'star'} size="lg" type={isStarred ? 'mono' : 'default'} />}
      data-testid={selectors.components.NavToolbar.markAsFavorite}
      onClick={() => {
        alert('TODO');
      }}
    />
  );
}

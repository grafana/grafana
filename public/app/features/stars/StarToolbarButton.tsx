import { useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Icon, ToolbarButton } from '@grafana/ui';
import { useGetStarsQuery } from 'app/api/clients/preferences/v1alpha1';

import { toggleStarState } from './useToggleStarState';

export type Props = {
  group: string;
  kind: string;
  id: string; // name of the thing with a star
};

export default function StarToolbarButton(props: Props) {
  const name = `user-${config.bootData.user.uid}`;
  const stars = useGetStarsQuery({ name });
  console.log('Stars', props.id, name, stars.data);
  const isStarred = useMemo(() => {
    if (stars.data?.spec.resource.length) {
      for (let info of stars.data?.spec.resource) {
        if (info.group === props.group && info.kind === props.kind) {
          return info.names.includes(props.id);
        }
      }
    }
    return false;
  }, [stars, props]);

  if (!config.bootData.user.uid || !props.id?.length) {
    return null;
  }

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
        toggleStarState(isStarred, name, props);
      }}
    />
  );
}

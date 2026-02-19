import { config } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';

import { getExternalUserMngLinkUrl } from './utils';

export interface Props {
  onExternalUserMngClick: () => void;
}

export const UsersExternalButton = ({ onExternalUserMngClick }: Props) => {
  return config.externalUserMngLinkUrl ? (
    <LinkButton
      onClick={onExternalUserMngClick}
      href={getExternalUserMngLinkUrl('manage-users')}
      target="_blank"
      rel="noopener"
    >
      {config.externalUserMngLinkName}
    </LinkButton>
  ) : null;
};

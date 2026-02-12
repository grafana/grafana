import { connect, ConnectedProps } from 'react-redux';

import { LinkButton } from '@grafana/ui';
import { StoreState } from 'app/types/store';

import { getExternalUserMngLinkUrl } from './utils';

export interface OwnProps {
  onExternalUserMngClick: () => void;
}

function mapStateToProps(state: StoreState) {
  return {
    externalUserMngLinkName: state.users.externalUserMngLinkName,
    externalUserMngLinkUrl: state.users.externalUserMngLinkUrl,
  };
}

const connector = connect(mapStateToProps);

export type Props = ConnectedProps<typeof connector> & OwnProps;

export const UsersExternalButtonUnconnected = ({
  externalUserMngLinkName,
  externalUserMngLinkUrl,
  onExternalUserMngClick,
}: Props) => {
  return externalUserMngLinkUrl ? (
    <LinkButton
      onClick={onExternalUserMngClick}
      href={getExternalUserMngLinkUrl('manage-users')}
      target="_blank"
      rel="noopener"
    >
      {externalUserMngLinkName}
    </LinkButton>
  ) : null;
};

export const UsersExternalButton = connector(UsersExternalButtonUnconnected);

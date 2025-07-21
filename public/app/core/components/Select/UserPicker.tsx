import debounce from 'debounce-promise';
import { isNil } from 'lodash';
import { Component } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { AsyncSelect } from '@grafana/ui';
import { OrgUser } from 'app/types/user';

export interface Props {
  onSelected: (user: SelectableValue<OrgUser>) => void;
  className?: string;
  inputId?: string;
}

export interface State {
  isLoading: boolean;
}

export class UserPicker extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { isLoading: false };
  }

  search = debounce(
    async (query?: string) => {
      this.setState({ isLoading: true });

      if (isNil(query)) {
        query = '';
      }

      return getBackendSrv()
        .get(`/api/org/users/lookup?query=${query}&limit=100`)
        .then((result: OrgUser[]) => {
          return result.map((user) => ({
            id: user.userId,
            uid: user.uid,
            value: user,
            label: user.login,
            imgUrl: user.avatarUrl,
            login: user.login,
          }));
        })
        .finally(() => {
          this.setState({ isLoading: false });
        });
    },
    300,
    { leading: true }
  );

  render() {
    const { className, onSelected, inputId } = this.props;
    const { isLoading } = this.state;

    return (
      <div className="user-picker" data-testid="userPicker">
        <AsyncSelect
          isClearable
          className={className}
          inputId={inputId}
          isLoading={isLoading}
          defaultOptions={true}
          loadOptions={this.search}
          onChange={onSelected}
          placeholder={t('user-picker.select-placeholder', 'Start typing to search for user')}
          noOptionsMessage={t('user-picker.noOptionsMessage-no-users-found', 'No users found')}
          aria-label={t('user-picker.select-aria-label', 'User picker')}
        />
      </div>
    );
  }
}

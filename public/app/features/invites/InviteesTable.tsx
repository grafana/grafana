import { memo } from 'react';

import { Trans } from '@grafana/i18n';
import { Invitee } from 'app/types/user';

import InviteeRow from './InviteeRow';

export interface Props {
  invitees: Invitee[];
}

const InviteesTable = memo(({ invitees }: Props) => {
  return (
    <table className="filter-table form-inline">
      <thead>
        <tr>
          <th>
            <Trans i18nKey="invites.invitees-table.email">Email</Trans>
          </th>
          <th>
            <Trans i18nKey="invites.invitees-table.name">Name</Trans>
          </th>
          <th />
          <th style={{ width: '34px' }} />
        </tr>
      </thead>
      <tbody data-testid="InviteesTable-body">
        {invitees.map((invitee, index) => {
          return <InviteeRow key={`${invitee.id}-${index}`} invitee={invitee} />;
        })}
      </tbody>
    </table>
  );
});

InviteesTable.displayName = 'InviteesTable';

export default InviteesTable;

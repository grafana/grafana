import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

import { UserIcon } from './UserIcon';
import { UserView } from './types';

export interface UsersIndicatorProps {
  /** An object that contains the user's details and 'lastActiveAt' status */
  users: UserView[];
  /** A limit of how many user icons to show before collapsing them and showing a number of users instead */
  limit: number;
  /** onClick handler for the user number indicator */
  onClick?: () => void;
}
export const UsersIndicator = ({ users, onClick, limit = 4 }: UsersIndicatorProps) => {
  const styles = useStyles2(getStyles);
  if (!users.length) {
    return null;
  }

  const limitReached = users.length > limit;
  const extraUsers = users.length - limit;
  const tooManyUsers = extraUsers > 9;

  return (
    <div className={styles.container} aria-label="Users indicator container">
      {limitReached && (
        <UserIcon onClick={onClick} userView={{ user: { name: 'Extra users' }, lastActiveAt: '' }} showTooltip={false}>
          {tooManyUsers ? '...' : `+${extraUsers}`}
        </UserIcon>
      )}
      {users
        .slice(0, limitReached ? limit : limit + 1)
        .reverse()
        .map((userView) => (
          <UserIcon key={userView.user.name} userView={userView} />
        ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: flex;
      justify-content: center;
      flex-direction: row-reverse;
      margin-left: ${theme.spacing(1)};

      & > button {
        margin-left: -${theme.spacing(1)}; // Overlay the elements a bit on top of each other
      }
    `,
  };
};

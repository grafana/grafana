import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { t } from '../../utils/i18n';

import { UserIcon } from './UserIcon';
import { UserView } from './types';

export interface UsersIndicatorProps {
  /** An object that contains the user's details and 'lastActiveAt' status */
  users: UserView[];
  /** A limit of how many user icons to show before collapsing them and showing a number of users instead */
  limit?: number;
  /** onClick handler for the user number indicator */
  onClick?: () => void;
}
export const UsersIndicator = ({ users, onClick, limit = 4 }: UsersIndicatorProps) => {
  const styles = useStyles2(getStyles);
  if (!users.length) {
    return null;
  }
  // Make sure limit is never negative
  limit = limit > 0 ? limit : 4;
  const limitReached = users.length > limit;
  const extraUsers = users.length - limit;
  // Prevent breaking the layout when there's more than 99 users
  const tooManyUsers = extraUsers > 99;

  return (
    <div
      className={styles.container}
      aria-label={t('grafana-ui.users-indicator.container-label', 'Users indicator container')}
    >
      {limitReached && (
        <UserIcon onClick={onClick} userView={{ user: { name: 'Extra users' }, lastActiveAt: '' }} showTooltip={false}>
          {tooManyUsers
            ? // eslint-disable-next-line @grafana/no-untranslated-strings
              '...'
            : `+${extraUsers}`}
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
    container: css({
      display: 'flex',
      justifyContent: 'center',
      flexDirection: 'row-reverse',
      marginLeft: theme.spacing(1),

      '& > button': {
        marginLeft: theme.spacing(-1), // Overlay the elements a bit on top of each other
      },
    }),
    dots: css({
      marginBottom: '3px',
    }),
  };
};

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';

import { UserIcon } from './UserIcon';
import { UserView } from './types';

export interface UsersIndicatorProps {
  /** An object that contains the user's details and an optional 'lastActiveAt' status */
  users: UserView[];
  /** A limit of how many user icons to show before collapsing them and showing a number of users instead */
  limit?: number;
  /** onClick handler for the user number indicator */
  onClick?: () => void;
}

/**
 * A component that displays a set of user icons indicating which users are currently active. If there are too many users to display all the icons, it will collapse the icons into a single icon with a number indicating the number of additional users.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/iconography-usersindicator--docs
 */
export const UsersIndicator = ({ users, onClick, limit = 4 }: UsersIndicatorProps) => {
  const styles = useStyles2(getStyles, limit);
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
      {users.slice(0, limitReached ? limit : limit + 1).map((userView, idx, arr) => (
        <UserIcon key={userView.user.name} userView={userView} />
      ))}
      {limitReached && (
        <UserIcon onClick={onClick} userView={{ user: { name: 'Extra users' } }} showTooltip={false}>
          {tooManyUsers
            ? // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              '...'
            : `+${extraUsers}`}
        </UserIcon>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, limit: number) => {
  return {
    container: css({
      display: 'flex',
      justifyContent: 'center',
      marginLeft: theme.spacing(1),
      isolation: 'isolate',

      '& > button': {
        marginLeft: theme.spacing(-1), // Overlay the elements a bit on top of each other

        // Ensure overlaying user icons are stacked correctly with z-index on each element
        ...Object.fromEntries(
          Array.from({ length: limit }).map((_, idx) => [
            `&:nth-of-type(${idx + 1})`,
            {
              zIndex: limit - idx,
            },
          ])
        ),
      },
    }),
    dots: css({
      marginBottom: '3px',
    }),
  };
};

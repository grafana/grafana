import { css } from '@emotion/css';

import { GrafanaTheme2, OrgRole } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2, Badge, Stack } from '@grafana/ui';
import { Role } from 'app/types/accessControl';

export interface Props {
  disabled?: boolean;
  basicRole?: OrgRole;
  roles?: Role[];
  onOpenDrawer: () => void;
}

export const RolePickerBadges = ({ disabled, basicRole, roles, onOpenDrawer }: Props) => {
  const { badge, badgeDisabled } = useStyles2(getStyles);
  const badgeStyle = disabled ? badgeDisabled : badge;

  const handleClick = () => {
    if (!disabled) {
      onOpenDrawer();
    }
  };

  return (
    <Stack gap={1}>
      {basicRole && (
        <Badge className={badgeStyle} color="blue" onClick={handleClick} text={basicRole} />
      )}
      {roles && roles.length > 0 && (
        <Badge
          className={badgeStyle}
          color="blue"
          onClick={handleClick}
          text={t('role-picker-drawer.role-count', '+{{count}}', { count: roles.length })}
        />
      )}
    </Stack>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    badge: css({
      cursor: 'pointer',
    }),
    badgeDisabled: css({
      cursor: 'not-allowed',
    }),
  };
}

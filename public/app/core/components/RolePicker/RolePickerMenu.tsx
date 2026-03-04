import { css, cx } from '@emotion/css';
import { type JSX } from 'react';

import { Permission } from '@grafana/api-clients/rtkq/legacy';
import { OrgRole } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { getSelectStyles } from '@grafana/ui/internal';
import { Role } from 'app/types/accessControl';

import { InheritedRoleInfo } from './hooks';
import { RolePickerContent } from './RolePickerContent';
import { MENU_MAX_HEIGHT } from './constants';
import { getStyles } from './styles';

interface RolePickerMenuProps {
  basicRole?: OrgRole;
  options: Role[];
  isFiltered?: boolean;
  appliedRoles: Role[];
  showGroups?: boolean;
  basicRoleDisabled?: boolean;
  disabledMessage?: string;
  showBasicRole?: boolean;
  onSelect: (roles: Role[]) => void;
  onBasicRoleSelect?: (role: OrgRole) => void;
  onUpdate: (newRoles: Role[], newBuiltInRole?: OrgRole) => void;
  updateDisabled?: boolean;
  apply?: boolean;
  offset: { vertical: number; horizontal: number };
  menuLeft?: boolean;
  /** Map of role UID → inherited role info (greyed out, not interactive) */
  inheritedRoles?: Map<string, InheritedRoleInfo>;
  /** Permissions from basic/custom roles that don't map to any named role */
  orphanPermissions?: Permission[];
}

export const RolePickerMenu = ({
  offset,
  menuLeft,
  ...contentProps
}: RolePickerMenuProps): JSX.Element => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const customStyles = useStyles2(getStyles);

  return (
    <div
      className={cx(
        styles.menu,
        customStyles.menuWrapper,
        { [customStyles.menuLeft]: menuLeft },
        css({
          top: `${offset.vertical}px`,
          left: !menuLeft ? `${offset.horizontal}px` : 'unset',
          right: menuLeft ? `${offset.horizontal}px` : 'unset',
        })
      )}
    >
      <RolePickerContent
        {...contentProps}
        maxHeight={`${MENU_MAX_HEIGHT}px`}
        showOnLeftSubMenu={menuLeft}
      />
    </div>
  );
};

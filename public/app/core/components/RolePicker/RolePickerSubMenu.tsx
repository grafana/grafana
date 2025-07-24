import { cx } from '@emotion/css';

import { Trans, t } from '@grafana/i18n';
import { Button, ScrollContainer, Stack, useStyles2, useTheme2 } from '@grafana/ui';
import { getSelectStyles } from '@grafana/ui/internal';
import { Role } from 'app/types/accessControl';

import { RoleMenuOption } from './RoleMenuOption';
import { MENU_MAX_HEIGHT } from './constants';
import { getStyles } from './styles';
import { isNotDelegatable } from './utils';

interface RolePickerSubMenuProps {
  options: Role[];
  selectedOptions: Role[];
  disabledOptions?: Role[];
  onSelect: (option: Role) => void;
  onClear?: () => void;
  showOnLeft?: boolean;
}

export const RolePickerSubMenu = ({
  options,
  selectedOptions,
  disabledOptions,
  onSelect,
  onClear,
  showOnLeft,
}: RolePickerSubMenuProps): JSX.Element => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const customStyles = useStyles2(getStyles);

  const onClearInternal = async () => {
    if (onClear) {
      onClear();
    }
  };

  return (
    <div
      className={cx(customStyles.subMenu, { [customStyles.subMenuLeft]: showOnLeft })}
      aria-label={t('role-picker.sub-menu-aria-label', 'Role picker submenu')}
    >
      <ScrollContainer maxHeight={`${MENU_MAX_HEIGHT}px`}>
        <div className={styles.optionBody}>
          {options.map((option, i) => (
            <RoleMenuOption
              data={option}
              useFilteredDisplayName={false}
              key={i}
              isSelected={
                !!(
                  option.uid &&
                  (!!selectedOptions.find((opt) => opt.uid === option.uid) ||
                    disabledOptions?.find((opt) => opt.uid === option.uid))
                )
              }
              disabled={
                !!(option.uid && disabledOptions?.find((opt) => opt.uid === option.uid)) || isNotDelegatable(option)
              }
              mapped={!!(option.uid && selectedOptions.find((opt) => opt.uid === option.uid && opt.mapped))}
              onChange={onSelect}
              hideDescription
            />
          ))}
        </div>
      </ScrollContainer>
      <div className={customStyles.subMenuButtonRow}>
        <Stack justifyContent="flex-end">
          <Button size="sm" fill="text" onClick={onClearInternal}>
            <Trans i18nKey="role-picker.sub-menu.clear-button">Clear</Trans>
          </Button>
        </Stack>
      </div>
    </div>
  );
};

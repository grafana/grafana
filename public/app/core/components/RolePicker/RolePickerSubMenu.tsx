import { cx } from '@emotion/css';
import React from 'react';

import { Button, CustomScrollbar, HorizontalGroup, useStyles2, useTheme2 } from '@grafana/ui';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { Role } from 'app/types';

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
      aria-label="Role picker submenu"
    >
      <CustomScrollbar autoHide={false} autoHeightMax={`${MENU_MAX_HEIGHT}px`} hideHorizontalTrack>
        <div className={styles.optionBody}>
          {options.map((option, i) => (
            <RoleMenuOption
              data={option}
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
              onChange={onSelect}
              hideDescription
            />
          ))}
        </div>
      </CustomScrollbar>
      <div className={customStyles.subMenuButtonRow}>
        <HorizontalGroup justify="flex-end">
          <Button size="sm" fill="text" onClick={onClearInternal}>
            Clear
          </Button>
        </HorizontalGroup>
      </div>
    </div>
  );
};

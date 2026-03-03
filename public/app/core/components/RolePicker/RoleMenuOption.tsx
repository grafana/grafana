import { cx } from '@emotion/css';
import { forwardRef, FormEvent, useCallback, useState } from 'react';

import { t } from '@grafana/i18n';
import { Checkbox, Icon, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import { getSelectStyles } from '@grafana/ui/internal';
import { Role } from 'app/types/accessControl';

import { PermissionsList } from './PermissionsList';
import { getStyles } from './styles';

interface RoleMenuOptionProps {
  data: Role;
  onChange: (value: Role) => void;
  useFilteredDisplayName?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
  disabled?: boolean;
  mapped?: boolean;
  hideDescription?: boolean;
  /** Role is inherited from a basic role or custom role — shown as checked + greyed out */
  inherited?: boolean;
  /** Source labels for inherited tooltip, e.g. ["Viewer"] or ["Viewer", "Alerting Full Admin"] */
  inheritedSources?: string[];
}

export const RoleMenuOption = forwardRef<HTMLDivElement, React.PropsWithChildren<RoleMenuOptionProps>>(
  (
    {
      data,
      isFocused,
      isSelected,
      useFilteredDisplayName,
      disabled,
      mapped,
      onChange,
      hideDescription,
      inherited,
      inheritedSources,
    },
    ref
  ) => {
    const theme = useTheme2();
    const styles = getSelectStyles(theme);
    const customStyles = useStyles2(getStyles);
    const [isExpanded, setIsExpanded] = useState(false);

    const onToggleExpand = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsExpanded((prev) => !prev);
    }, []);

    const isDisabled = disabled || mapped || inherited;
    let disabledMessage = '';
    if (disabled && !inherited) {
      disabledMessage = 'You do not have permissions to assign this role.';
      if (mapped) {
        disabledMessage = 'Role assignment cannot be removed because the role is mapped through group sync.';
      }
    }

    // Build additive tooltip: existing description + inherited source info
    const tooltipParts: string[] = [];
    if (data.description) {
      tooltipParts.push(data.description);
    }
    if (inherited && inheritedSources?.length) {
      tooltipParts.push(`Included in ${inheritedSources.join(', ')}`);
    }
    if (disabledMessage) {
      tooltipParts.push(disabledMessage);
    }
    const fullTooltip = tooltipParts.join(' · ');

    const wrapperClassName = cx(
      styles.option,
      isFocused && styles.optionFocused,
      isDisabled && customStyles.menuOptionDisabled,
      inherited && customStyles.menuOptionInherited
    );

    const onChangeInternal = (event: FormEvent<HTMLElement>) => {
      if (isDisabled) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onChange(data);
    };

    // Show expand button for fixed and plugin roles (they have permissions to inspect)
    const isExpandable = data.name?.startsWith('fixed:') || data.name?.startsWith('plugins:') || !data.name?.startsWith('basic_');

    return (
      <div>
        {/* TODO: fix keyboard a11y */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          ref={ref}
          className={wrapperClassName}
          aria-label={t('role-picker.menu-option-aria-label', 'Role picker option')}
          onClick={onChangeInternal}
        >
          <Checkbox
            value={isSelected || inherited}
            className={customStyles.menuOptionCheckbox}
            onChange={onChangeInternal}
            disabled={isDisabled}
          />
          <div className={cx(styles.optionBody, customStyles.menuOptionBody)}>
            <span>{(useFilteredDisplayName && data.filteredDisplayName) || data.displayName || data.name}</span>
            {inherited && (
              <span className={customStyles.inheritedBadge}>
                (included in {inheritedSources?.join(', ')})
              </span>
            )}
            {!hideDescription && data.description && !inherited && (
              <div className={styles.optionDescription}>{data.description}</div>
            )}
          </div>
          {isExpandable && (
            <button
              className={customStyles.menuOptionExpandBtn}
              onClick={onToggleExpand}
              title={isExpanded ? 'Hide permissions' : 'Show permissions'}
            >
              <Icon name={isExpanded ? 'angle-down' : 'angle-right'} size="sm" />
            </button>
          )}
          {fullTooltip && !inherited && !isExpanded && (
            <Tooltip content={fullTooltip}>
              <Icon name={disabledMessage ? 'lock' : 'info-circle'} className={customStyles.menuOptionInfoSign} />
            </Tooltip>
          )}
          {inherited && fullTooltip && !isExpanded && (
            <Tooltip content={fullTooltip}>
              <Icon name="info-circle" className={customStyles.menuOptionInfoSign} />
            </Tooltip>
          )}
        </div>
        {isExpanded && data.uid && <PermissionsList roleUid={data.uid} />}
      </div>
    );
  }
);

RoleMenuOption.displayName = 'RoleMenuOption';

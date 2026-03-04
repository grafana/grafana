import { OrgRole } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Select } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

interface Props {
  value: OrgRole;
  disabled?: boolean;
  'aria-label'?: string;
  inputId?: string;
  onChange: (role: OrgRole) => void;
  autoFocus?: boolean;
  width?: number | 'auto';
}

// Include OrgRole.None only when licensed access control is enabled (Enterprise RBAC)
const basicRoles = Object.values(OrgRole).filter((r) => {
  if (r === OrgRole.None && !contextSrv.licensedAccessControlEnabled()) {
    return false;
  }
  return true;
});

const options = basicRoles.map((r) => ({
  label: r === OrgRole.None ? 'No basic role' : r,
  value: r,
}));

export function OrgRolePicker({ value, onChange, 'aria-label': ariaLabel, inputId, autoFocus, ...restProps }: Props) {
  return (
    <Select
      inputId={inputId}
      value={value}
      options={options}
      onChange={(val) => onChange(val.value ?? OrgRole.None)}
      placeholder={t('admin.org-role-picker.placeholder-choose-role', 'Choose role...')}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      {...restProps}
    />
  );
}

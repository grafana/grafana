import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';

import { Permission } from '@grafana/api-clients/rtkq/legacy';
import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Button, ClipboardButton, Combobox, ComboboxOption, Field, IconButton, Input, Stack, TextArea, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useCreateRoleMutation, useUpdateRoleMutation, useGetRoleQuery, useListRolesQuery } from 'app/api/clients/roles';
import { fetchRoleDetail } from 'app/core/components/RolePicker/hooks';
import { Role } from 'app/types/accessControl';

interface RoleFormData {
  displayName: string;
  description: string;
  group: string;
  permissions: Array<{ action: string; scope: string }>;
}

function getRoleType(role: Role): 'basic' | 'fixed' | 'custom' | 'plugin' {
  const name = role.name || '';
  if (name.startsWith('basic:')) {
    return 'basic';
  }
  if (name.startsWith('fixed:')) {
    return 'fixed';
  }
  if (name.startsWith('plugins:')) {
    return 'plugin';
  }
  return 'custom';
}

/** Returns true if the role should be completely read-only (no editing at all). */
function isReadOnlyRole(role: Role): boolean {
  const roleType = getRoleType(role);
  if (roleType === 'fixed' || roleType === 'plugin') {
    return true;
  }
  const name = role.name || '';
  if (name === 'basic:grafana_admin' || name === 'basic:none' || name.startsWith('managed:')) {
    return true;
  }
  return false;
}

/** Collect all unique actions from a set of roles by fetching their details. */
function useAvailableActions(): ComboboxOption<string>[] {
  const { data: roles = [] } = useListRolesQuery({ includeHidden: true });
  const [actions, setActions] = useState<ComboboxOption<string>[]>([]);

  useEffect(() => {
    // Fetch details from key basic roles to get a comprehensive action list
    const keyUids = ['basic_viewer', 'basic_editor', 'basic_admin', 'basic_grafana_admin'];
    const fetchActions = async () => {
      const allActions = new Set<string>();
      for (const uid of keyUids) {
        try {
          const detail = await fetchRoleDetail(uid);
          for (const perm of detail.permissions || []) {
            if (perm.action) {
              allActions.add(perm.action);
            }
          }
        } catch {
          // Skip roles that fail to fetch
        }
      }
      // Also add actions from any fixed roles that are visible
      const fixedRoles = roles.filter((r) => (r.name || '').startsWith('fixed:'));
      // Fetch a sample of fixed roles for more coverage (limit to avoid too many calls)
      for (const role of fixedRoles.slice(0, 10)) {
        if (role.uid) {
          try {
            const detail = await fetchRoleDetail(role.uid);
            for (const perm of detail.permissions || []) {
              if (perm.action) {
                allActions.add(perm.action);
              }
            }
          } catch {
            // Skip
          }
        }
      }
      const sorted = Array.from(allActions).sort();
      setActions(sorted.map((a) => ({ label: a, value: a })));
    };
    fetchActions();
  }, [roles]);

  return actions;
}

/** Format permissions for clipboard as Terraform-friendly HCL or JSON. */
function formatPermissionsForClipboard(
  perms: Array<{ action: string; scope: string }>,
  roleName?: string
): string {
  const lines: string[] = [];
  if (roleName) {
    lines.push(`# Permissions for: ${roleName}`);
    lines.push('');
  }
  lines.push('# Terraform format (grafana_role resource)');
  for (const p of perms) {
    if (!p.action) {
      continue;
    }
    const scope = p.scope || '';
    lines.push(`permissions {`);
    lines.push(`  action = "${p.action}"`);
    if (scope) {
      lines.push(`  scope  = "${scope}"`);
    }
    lines.push(`}`);
  }
  lines.push('');
  lines.push('# JSON format');
  const json = perms
    .filter((p) => p.action)
    .map((p) => ({ action: p.action, scope: p.scope || undefined }));
  lines.push(JSON.stringify(json, null, 2));
  return lines.join('\n');
}

interface RoleEditFormProps {
  role?: Role;
  onSaved: () => void;
  forceReadOnly?: boolean;
}

export const RoleEditForm = ({ role, onSaved, forceReadOnly = false }: RoleEditFormProps) => {
  const styles = useStyles2(getStyles);
  const isEditing = !!role;
  const isBasicRole = role ? getRoleType(role) === 'basic' : false;
  const roleIsReadOnly = role ? isReadOnlyRole(role) : false;
  const isReadOnly = forceReadOnly || roleIsReadOnly;
  const availableActions = useAvailableActions();
  const { data: allRoles = [] } = useListRolesQuery({ includeHidden: true });

  const [createRole, { isLoading: isCreating }] = useCreateRoleMutation();
  const [updateRole, { isLoading: isUpdating }] = useUpdateRoleMutation();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  // Fetch full role details (with permissions) when editing
  const { data: roleDetail, isLoading: isLoadingDetail } = useGetRoleQuery(
    { roleUid: role?.uid || '' },
    { skip: !role?.uid }
  );

  const {
    handleSubmit,
    register,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<RoleFormData>({
    mode: 'onBlur',
    defaultValues: {
      displayName: '',
      description: '',
      group: '',
      permissions: [{ action: '', scope: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'permissions',
  });

  // Populate form when role detail loads
  useEffect(() => {
    if (roleDetail) {
      reset({
        displayName: roleDetail.displayName || '',
        description: roleDetail.description || '',
        group: roleDetail.group || '',
        permissions:
          roleDetail.permissions && roleDetail.permissions.length > 0
            ? roleDetail.permissions.map((p: Permission) => ({
                action: p.action || '',
                scope: p.scope || '',
              }))
            : [{ action: '', scope: '' }],
      });
    }
  }, [roleDetail, reset]);

  // Track currently used actions to filter them out of dropdown
  const currentPermissions = watch('permissions');
  const usedActions = useMemo(() => {
    return new Set(currentPermissions?.map((p) => p.action).filter(Boolean) || []);
  }, [currentPermissions]);

  const getFilteredActions = useCallback(
    (currentValue: string) => {
      return availableActions.filter((opt) => !usedActions.has(opt.value) || opt.value === currentValue);
    },
    [availableActions, usedActions]
  );

  // "Copy from role" for custom roles
  const copyFromRoleOptions: ComboboxOption<string>[] = useMemo(() => {
    return allRoles
      .filter((r) => {
        const name = r.name || '';
        // Show basic roles (Viewer, Editor, Admin) and fixed roles as copy sources
        return (
          (name.startsWith('basic:') && name !== 'basic:none' && name !== 'basic:grafana_admin') ||
          name.startsWith('fixed:')
        );
      })
      .map((r) => {
        const name = r.name || '';
        const group = r.group || '';
        const label = name.startsWith('fixed:') && group
          ? `${group}: ${r.displayName || name}`
          : r.displayName || name;
        return { label, value: r.uid || '' };
      });
  }, [allRoles]);

  const handleCopyFromRole = useCallback(
    async (roleUid: string) => {
      try {
        const detail = await fetchRoleDetail(roleUid);
        const newPerms = (detail.permissions || [])
          .filter((p: Permission) => !!p.action)
          .map((p: Permission) => ({ action: p.action || '', scope: p.scope || '' }));
        if (newPerms.length > 0) {
          // Merge with existing — add permissions that don't already exist
          const existing = new Set(
            currentPermissions?.map((p) => `${p.action}|${p.scope}`).filter((k) => k !== '|') || []
          );
          const toAdd = newPerms.filter((p: { action: string; scope: string }) => !existing.has(`${p.action}|${p.scope}`));
          for (const perm of toAdd) {
            append(perm);
          }
          setError(null);
          setSuccessMessage(null);
          setCopyMessage(`Copied ${toAdd.length} permissions (${newPerms.length - toAdd.length} duplicates skipped). Click "Save changes" to apply.`);
        }
      } catch {
        setError('Failed to fetch role permissions.');
      }
    },
    [currentPermissions, append]
  );

  const onSubmit = useCallback(
    async (data: RoleFormData) => {
      setError(null);
      setSuccessMessage(null);
      setCopyMessage(null);
      const permissions = data.permissions
        .filter((p) => p.action.trim() !== '')
        .map((p) => {
          const action = p.action.trim();
          let scope = p.scope.trim() || undefined;
          // The update API rejects certain seed-only scopes (e.g. receivers:type:new).
          // Normalize non-standard scopes to their wildcard form to avoid validation errors.
          if (scope && !scope.endsWith(':*') && scope !== '*') {
            const parts = scope.split(':');
            // Standard patterns: "resource:*", "resource:uid:value", "resource:id:value"
            // If it doesn't match uid/id pattern, use wildcard for that resource type
            if (parts.length >= 3 && parts[1] !== 'uid' && parts[1] !== 'id') {
              scope = `${parts[0]}:*`;
            }
          }
          return { action, scope };
        });

      try {
        if (isEditing && role?.uid) {
          await updateRole({
            roleUid: role.uid,
            updateRoleCommand: {
              displayName: isBasicRole ? roleDetail?.displayName || '' : data.displayName,
              description: isBasicRole ? roleDetail?.description || '' : data.description,
              group: isBasicRole ? roleDetail?.group || '' : data.group,
              permissions,
              version: (roleDetail?.version || 0) + 1,
              ...(isBasicRole ? { global: true } : {}),
            },
          }).unwrap();
          setSuccessMessage('Role updated successfully.');
        } else {
          // API requires a unique `name` field — generate from displayName
          const slug = data.displayName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
          const name = `custom:${slug}`;
          await createRole({
            createRoleForm: {
              name,
              displayName: data.displayName,
              description: data.description,
              group: data.group,
              permissions,
            },
          }).unwrap();
          // Navigate back to list after creating
          onSaved();
        }
      } catch (err: unknown) {
        let message = 'Failed to save role';
        if (err && typeof err === 'object') {
          const apiErr = err as { data?: { message?: string }; message?: string; error?: string };
          message = apiErr.data?.message || apiErr.message || apiErr.error || message;
        }
        setError(message);
      }
    },
    [isEditing, isBasicRole, role, roleDetail, createRole, updateRole, onSaved]
  );

  if (isEditing && isLoadingDetail) {
    return (
      <Page.Contents>
        <p>{t('admin.role-edit.loading', 'Loading role details...')}</p>
      </Page.Contents>
    );
  }

  return (
    <Page.Contents>
      <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: '700px' }}>
        <Stack direction="column" gap={2}>
          {/* Warning banners */}
          {isReadOnly && (
            <Alert
              title={
                forceReadOnly && !roleIsReadOnly
                  ? t('admin.role-edit.no-permission-title', 'Read-only view')
                  : t('admin.role-edit.read-only-title', 'Read-only role')
              }
              severity="info"
            >
              {forceReadOnly && !roleIsReadOnly
                ? t(
                    'admin.role-edit.no-permission-body',
                    'You do not have permission to edit this role. You can view its configuration below.'
                  )
                : t(
                    'admin.role-edit.read-only-body',
                    'This role is managed by Grafana and cannot be edited. You can view its permissions below.'
                  )}
            </Alert>
          )}

          {isBasicRole && !isReadOnly && (
            <Alert
              title={t('admin.role-edit.basic-role-warning-title', 'Editing a basic role')}
              severity="warning"
            >
              {t(
                'admin.role-edit.basic-role-warning-body',
                'Changes to basic roles affect every user at this level. Basic roles update automatically — new permissions may be added when Grafana is upgraded.'
              )}
            </Alert>
          )}

          {!isBasicRole && !isReadOnly && isEditing && (
            <Alert
              title={t('admin.role-edit.custom-role-warning-title', 'Custom role')}
              severity="info"
            >
              {t(
                'admin.role-edit.custom-role-warning-body',
                'Custom roles do not automatically update. When Grafana is upgraded, new permissions will not be added to this role. You\'ll need to update it manually.'
              )}
            </Alert>
          )}

          {/* Metadata fields */}
          <Field
            label={t('admin.role-edit.label-display-name', 'Display name')}
            required={!isBasicRole}
            invalid={!!errors.displayName}
            error={errors.displayName ? 'Display name is required' : undefined}
          >
            <Input
              id="display-name-input"
              {...register('displayName', { required: !isBasicRole })}
              disabled={isBasicRole || isReadOnly}
              placeholder={isBasicRole ? (role?.displayName || '') : ''}
            />
          </Field>

          <Field label={t('admin.role-edit.label-description', 'Description')}>
            <TextArea
              id="description-input"
              {...register('description')}
              disabled={isBasicRole || isReadOnly}
              rows={3}
            />
          </Field>

          <Field label={t('admin.role-edit.label-group', 'Group')}>
            <Input
              id="group-input"
              {...register('group')}
              disabled={isBasicRole || isReadOnly}
              placeholder={isBasicRole ? (role?.group || '') : 'e.g. alerting'}
            />
          </Field>

          {/* Permissions section */}
          <div>
            <Stack direction="row" gap={2} alignItems="center">
              <h4 className={styles.sectionTitle}>
                {t('admin.role-edit.permissions-title', 'Permissions')}
                <span className={styles.permCount}>({fields.length})</span>
              </h4>
              {!isBasicRole && !isReadOnly && (
                <div style={{ width: '250px' }}>
                  <Combobox
                    options={copyFromRoleOptions}
                    value={null}
                    onChange={(opt) => {
                      if (opt?.value) {
                        handleCopyFromRole(opt.value);
                      }
                    }}
                    placeholder="Copy from role..."
                    isClearable
                  />
                </div>
              )}
              <ClipboardButton
                icon="copy"
                variant="secondary"
                size="sm"
                getText={() =>
                  formatPermissionsForClipboard(
                    currentPermissions || [],
                    role?.displayName || role?.name
                  )
                }
              >
                {t('admin.role-edit.copy-permissions', 'Copy permissions')}
              </ClipboardButton>
            </Stack>

            {isReadOnly ? (
              <div className={styles.readOnlyPermissions}>
                {fields.map((field, index) => (
                  <div key={field.id} className={styles.readOnlyPermRow}>
                    <span className={styles.readOnlyAction}>{currentPermissions?.[index]?.action || ''}</span>
                    {currentPermissions?.[index]?.scope && (
                      <span className={styles.readOnlyScope}>{currentPermissions[index].scope}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className={styles.permissionsList}>
                  {fields.map((field, index) => (
                    <Stack key={field.id} direction="row" gap={1} alignItems="flex-start">
                      <Field label={index === 0 ? t('admin.role-edit.label-action', 'Action') : undefined} style={{ flex: 2 }}>
                        <Controller
                          control={control}
                          name={`permissions.${index}.action`}
                          render={({ field: controllerField }) => (
                            <Combobox
                              options={getFilteredActions(controllerField.value)}
                              value={controllerField.value || null}
                              onChange={(opt) => controllerField.onChange(opt?.value ?? '')}
                              placeholder="Search or type action..."
                              createCustomValue
                            />
                          )}
                        />
                      </Field>
                      <Field label={index === 0 ? t('admin.role-edit.label-scope', 'Scope') : undefined} style={{ flex: 2 }}>
                        <Input
                          {...register(`permissions.${index}.scope`)}
                          placeholder="e.g. datasources:* (optional)"
                        />
                      </Field>
                      <div className={index === 0 ? styles.removeButtonWithLabel : styles.removeButton}>
                        <IconButton
                          name="trash-alt"
                          size="md"
                          onClick={() => remove(index)}
                          aria-label="Remove permission"
                          tooltip="Remove permission"
                        />
                      </div>
                    </Stack>
                  ))}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  onClick={() => append({ action: '', scope: '' })}
                  type="button"
                >
                  {t('admin.role-edit.add-permission-button', 'Add permission')}
                </Button>
              </>
            )}
          </div>

          {/* Submit buttons */}
          <Stack direction="row" gap={2}>
            {!isReadOnly && (
              <Button type="submit" disabled={isCreating || isUpdating}>
                {isEditing
                  ? t('admin.role-edit.save-button', 'Save changes')
                  : t('admin.role-edit.create-button', 'Create role')}
              </Button>
            )}
            <Button variant="secondary" onClick={onSaved} type="button">
              {t('admin.role-edit.cancel-button', 'Back to all roles')}
            </Button>
          </Stack>

          {copyMessage && <Alert title="Copied" severity="info">{copyMessage}</Alert>}
          {successMessage && <Alert title="Saved" severity="success">{successMessage}</Alert>}
          {error && <Alert title="Error" severity="error">{error}</Alert>}
        </Stack>
      </form>
    </Page.Contents>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  sectionTitle: css({
    fontSize: theme.typography.h5.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    marginBottom: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  permCount: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightRegular,
  }),
  permissionsList: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
  }),
  removeButton: css({
    paddingTop: theme.spacing(0.5),
  }),
  removeButtonWithLabel: css({
    paddingTop: theme.spacing(3),
  }),
  readOnlyPermissions: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    maxHeight: '400px',
    overflowY: 'auto',
    padding: theme.spacing(1),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    marginBottom: theme.spacing(1),
  }),
  readOnlyPermRow: css({
    display: 'flex',
    gap: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.5,
    padding: theme.spacing(0, 0.5),
  }),
  readOnlyAction: css({
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
  readOnlyScope: css({
    color: theme.colors.text.secondary,
  }),
});

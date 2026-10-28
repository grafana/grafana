import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, Icon, IconButton, Menu, RadioButtonGroup, Stack, useStyles2 } from '@grafana/ui';

import { type FacetTerm } from '../api/globalSearchApi';
import { type OwnerOption } from '../hooks/useOwnerNames';
import {
  URV_GROUPS,
  URV_SORTS,
  URV_UPDATED,
  type UrvGroup,
  type UrvPlace,
  type UrvSort,
  type UrvState,
  type UrvUpdated,
  toggleValue,
} from '../hooks/useUrvState';
import { kindInfoFor } from '../kinds';

const MAX_MENU_TAGS = 20;
const MAX_MENU_OWNERS = 20;
// Global search can't answer these yet: no "shared with me" field, and trash isn't indexed.
const UNAVAILABLE_PLACES: UrvPlace[] = ['shared', 'trash'];

interface Props {
  state: UrvState;
  update: (patch: Partial<UrvState>) => void;
  types: FacetTerm[];
  tags: FacetTerm[];
  owners: OwnerOption[];
  ownerName: (createdBy: string) => string;
  canFilterProvisioned: boolean;
}

export function updatedLabel(updated: UrvUpdated): string {
  return {
    '24h': t('urv.filters.updated-24h', 'Last 24 hours'),
    '7d': t('urv.filters.updated-7d', 'Last 7 days'),
    '30d': t('urv.filters.updated-30d', 'Last 30 days'),
  }[updated];
}

function countLabel(name: string, total: number): string {
  return t('urv.filters.option-count', '{{name}} ({{total}})', {
    name,
    total: total.toLocaleString(),
    interpolation: { escapeValue: false },
  });
}

function sortLabel(sort: UrvSort): string {
  return {
    updated: t('urv.sort.updated', 'Updated'),
    created: t('urv.sort.created', 'Created'),
    title: t('urv.sort.title', 'Name'),
    relevance: t('urv.sort.relevance', 'Relevance'),
  }[sort];
}

function groupLabel(group: UrvGroup): string {
  return {
    type: t('urv.group.type', 'Type'),
    none: t('urv.group.none', 'None'),
  }[group];
}

export function FilterBar({ state, update, types, tags, owners, ownerName, canFilterProvisioned }: Props) {
  const styles = useStyles2(getStyles);

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
  if (state.type) {
    chips.push({
      key: 'type',
      label: t('urv.filters.chip-type', 'Type: {{value}}', {
        value: kindInfoFor(state.type).plural(),
        interpolation: { escapeValue: false },
      }),
      onRemove: () => update({ type: undefined }),
    });
  }
  for (const tag of state.tags) {
    chips.push({
      key: `tag:${tag}`,
      label: t('urv.filters.chip-tag', 'Tag: {{value}}', { value: tag, interpolation: { escapeValue: false } }),
      onRemove: () => update({ tags: toggleValue(state.tags, tag) }),
    });
  }
  for (const owner of state.owners) {
    chips.push({
      key: `owner:${owner}`,
      label: t('urv.filters.chip-owner', 'Owner: {{value}}', {
        value: ownerName(owner),
        interpolation: { escapeValue: false },
      }),
      onRemove: () => update({ owners: toggleValue(state.owners, owner) }),
    });
  }
  if (state.updated) {
    chips.push({
      key: 'updated',
      label: t('urv.filters.chip-updated', 'Updated: {{value}}', {
        value: updatedLabel(state.updated),
        interpolation: { escapeValue: false },
      }),
      onRemove: () => update({ updated: undefined }),
    });
  }
  if (state.provisioned) {
    chips.push({
      key: 'provisioned',
      label: t('urv.filters.chip-provisioned', 'Provisioned only'),
      onRemove: () => update({ provisioned: false }),
    });
  }

  const check = (on: boolean) => (on ? 'check' : undefined);
  const filterMenu = (
    <Menu>
      <Menu.Item
        label={t('urv.filters.type', 'Type')}
        icon="layer-group"
        childItems={types.map((term) => (
          <Menu.Item
            key={term.value}
            label={countLabel(kindInfoFor(term.value).plural(), term.count)}
            icon={check(state.type === term.value)}
            onClick={() => update({ type: state.type === term.value ? undefined : term.value })}
          />
        ))}
      />
      <Menu.Item
        label={t('urv.filters.tag', 'Tag')}
        icon="tag-alt"
        childItems={tags.slice(0, MAX_MENU_TAGS).map((term) => (
          <Menu.Item
            key={term.value}
            label={countLabel(term.value, term.count)}
            icon={check(state.tags.includes(term.value))}
            onClick={() => update({ tags: toggleValue(state.tags, term.value) })}
          />
        ))}
      />
      <Menu.Item
        label={t('urv.filters.owner', 'Owner')}
        icon="user"
        childItems={owners.slice(0, MAX_MENU_OWNERS).map((owner) => (
          <Menu.Item
            key={owner.value}
            label={owner.label}
            icon={check(state.owners.includes(owner.value))}
            onClick={() => update({ owners: toggleValue(state.owners, owner.value) })}
          />
        ))}
      />
      <Menu.Item
        label={t('urv.filters.updated', 'Updated')}
        icon="clock-nine"
        childItems={URV_UPDATED.map((updated) => (
          <Menu.Item
            key={updated}
            label={updatedLabel(updated)}
            icon={check(state.updated === updated)}
            onClick={() => update({ updated: state.updated === updated ? undefined : updated })}
          />
        ))}
      />
      {canFilterProvisioned && (
        <Menu.Item
          label={t('urv.filters.provisioned', 'Provisioned only')}
          description={t('urv.filters.provisioned-description', 'Synced from a Git repository')}
          icon={state.provisioned ? 'check' : 'exchange-alt'}
          role="menuitemcheckbox"
          ariaChecked={state.provisioned}
          onClick={() => update({ provisioned: !state.provisioned })}
        />
      )}
    </Menu>
  );

  const placeOptions: Array<SelectableValue<UrvPlace>> = [
    { value: 'all', label: t('urv.places.all', 'All'), icon: 'layer-group' },
    { value: 'recent', icon: 'clock-nine', description: t('urv.places.recent', 'Recently viewed dashboards') },
    { value: 'starred', icon: 'star', description: t('urv.places.starred', 'Starred') },
    {
      value: 'shared',
      icon: 'users-alt',
      description: t('urv.places.shared', 'Shared with me: not available from global search yet'),
    },
    {
      value: 'trash',
      icon: 'trash-alt',
      description: t('urv.places.trash', 'Trash: not available from global search yet'),
    },
  ];

  return (
    <Stack alignItems="center" gap={1} wrap="wrap">
      <Dropdown overlay={filterMenu} placement="bottom-start">
        <div className={styles.field} role="button" tabIndex={0} aria-label={t('urv.filters.open', 'Add a filter')}>
          <Icon name="filter" className={styles.fieldIcon} />
          {chips.length === 0 && (
            <span className={styles.placeholder}>
              {canFilterProvisioned
                ? t('urv.filters.placeholder', 'Filter by type, tag, owner, updated or provisioned')
                : t('urv.filters.placeholder-no-provisioned', 'Filter by type, tag, owner or updated')}
            </span>
          )}
          {chips.map((chip) => (
            <span key={chip.key} className={styles.chip}>
              {chip.label}
              <IconButton
                name="times"
                size="xs"
                aria-label={t('urv.filters.remove', 'Remove {{filter}}', {
                  filter: chip.label,
                  interpolation: { escapeValue: false },
                })}
                onClick={(event) => {
                  event.stopPropagation();
                  chip.onRemove();
                }}
              />
            </span>
          ))}
        </div>
      </Dropdown>

      <RadioButtonGroup
        options={placeOptions}
        value={state.place}
        disabledOptions={UNAVAILABLE_PLACES}
        onChange={(place) => update({ place })}
      />

      <MenuSelect
        prefix={t('urv.group.label', 'Group')}
        value={state.group}
        options={URV_GROUPS.map((group) => ({ value: group, label: groupLabel(group) }))}
        onChange={(group) => update({ group })}
      />
      <MenuSelect
        prefix={t('urv.sort.label', 'Sort')}
        value={state.sort}
        options={URV_SORTS.map((sort) => ({ value: sort, label: sortLabel(sort) }))}
        onChange={(sort) => update({ sort })}
      />
    </Stack>
  );
}

interface MenuSelectProps<T extends string> {
  prefix: ReactNode;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

/** A compact "Label: value" picker, like the Group and Sort controls in the design. */
function MenuSelect<T extends string>({ prefix, value, options, onChange }: MenuSelectProps<T>) {
  const styles = useStyles2(getStyles);
  const current = options.find((option) => option.value === value);
  return (
    <Dropdown
      placement="bottom-end"
      overlay={
        <Menu>
          {options.map((option) => (
            <Menu.Item
              key={option.value}
              label={option.label}
              icon={option.value === value ? 'check' : undefined}
              onClick={() => onChange(option.value)}
            />
          ))}
        </Menu>
      }
    >
      <button type="button" className={styles.menuSelect}>
        <span className={styles.menuSelectPrefix}>{prefix}</span>
        {current?.label}
        <Icon name="angle-down" />
      </button>
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  field: css({
    flex: 1,
    minWidth: 280,
    minHeight: theme.spacing(theme.components.height.md),
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.25, 1),
    border: `1px solid ${theme.components.input.borderColor}`,
    borderRadius: theme.shape.radius.default,
    background: theme.components.input.background,
    cursor: 'pointer',
    '&:hover': {
      borderColor: theme.components.input.borderHover,
    },
  }),
  fieldIcon: css({
    color: theme.colors.text.secondary,
  }),
  placeholder: css({
    color: theme.colors.text.secondary,
  }),
  chip: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0, 0.5, 0, 1),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  menuSelect: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    height: theme.spacing(theme.components.height.md),
    padding: theme.spacing(0, 1.5),
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  menuSelectPrefix: css({
    color: theme.colors.text.secondary,
  }),
});

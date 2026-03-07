import { useCallback, useRef } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DashboardLink } from '@grafana/schema';
import { Field, Input, Select, Switch, TagsInput } from '@grafana/ui';

import { DashboardScene } from '../../scene/DashboardScene';

import { LinkEdit } from './LinkAddEditableElement';
import { linkEditActions } from './actions';
import { LINK_ICON_MAP } from './utils';

const linkIconOptions = Object.keys(LINK_ICON_MAP).map((key) => ({ label: key, value: key }));

function useLinkState(linkEdit: LinkEdit) {
  const dashboard = linkEdit.state.dashboardRef.resolve();
  const { links } = dashboard.useState();
  const linkIndex = linkEdit.state.linkIndex;
  const allLinks = links ?? [];
  const link: DashboardLink | undefined = allLinks[linkIndex];
  return { dashboard, links: allLinks, link, linkIndex };
}

function commitUpdate(dashboard: DashboardScene, linkIndex: number, oldLink: DashboardLink, newLink: DashboardLink) {
  linkEditActions.updateLink({ dashboard, linkIndex, oldLink, newLink });
}

export function LinkTitleInput({ linkEdit }: { linkEdit: LinkEdit }) {
  const { dashboard, link, linkIndex } = useLinkState(linkEdit);
  const oldTitle = useRef(link?.title ?? '');

  if (!link) {
    return null;
  }

  return (
    <Field label={t('dashboard-scene.link-options.title', 'Title')} noMargin>
      <Input
        value={link.title}
        onFocus={() => {
          oldTitle.current = link.title;
        }}
        onChange={(e) => {
          const links = [...(dashboard.state.links ?? [])];
          links[linkIndex] = { ...link, title: e.currentTarget.value };
          dashboard.setState({ links });
        }}
        onBlur={() => {
          if (oldTitle.current !== link.title) {
            linkEditActions.updateLink({
              dashboard,
              linkIndex,
              oldLink: { ...link, title: oldTitle.current },
              newLink: link,
              description: t('dashboard-scene.link-edit-actions.change-title', 'Change link title'),
            });
          }
        }}
      />
    </Field>
  );
}

export function LinkTypeSelect({ linkEdit }: { linkEdit: LinkEdit }) {
  const { dashboard, link, linkIndex } = useLinkState(linkEdit);

  const linkTypeOptions = [
    {
      value: 'dashboards',
      label: t('dashboard-scene.link-options.type-dashboards', 'Dashboards'),
    },
    { value: 'link', label: t('dashboard-scene.link-options.type-link', 'Link') },
  ];

  const onTypeChange = useCallback(
    (selectedItem: SelectableValue) => {
      if (!link) {
        return;
      }
      const updated = { ...link, type: selectedItem.value };
      if (updated.type === 'dashboards') {
        updated.url = '';
        updated.tooltip = '';
      } else {
        updated.tags = [];
      }
      commitUpdate(dashboard, linkIndex, link, updated);
    },
    [dashboard, link, linkIndex]
  );

  if (!link) {
    return null;
  }

  return (
    <Field label={t('dashboard-scene.link-options.type', 'Type')} noMargin>
      <Select value={link.type} options={linkTypeOptions} onChange={onTypeChange} />
    </Field>
  );
}

export function LinkTagsInput({ linkEdit }: { linkEdit: LinkEdit }) {
  const { dashboard, link, linkIndex } = useLinkState(linkEdit);

  if (!link || link.type !== 'dashboards') {
    return null;
  }

  return (
    <Field label={t('dashboard-scene.link-options.with-tags', 'With tags')} noMargin>
      <TagsInput tags={link.tags} onChange={(tags) => commitUpdate(dashboard, linkIndex, link, { ...link, tags })} />
    </Field>
  );
}

export function LinkUrlInput({ linkEdit }: { linkEdit: LinkEdit }) {
  const { dashboard, link, linkIndex } = useLinkState(linkEdit);
  const oldUrl = useRef(link?.url ?? '');

  if (!link || link.type !== 'link') {
    return null;
  }

  return (
    <Field label={t('dashboard-scene.link-options.url', 'URL')} noMargin>
      <Input
        value={link.url}
        onFocus={() => {
          oldUrl.current = link.url ?? '';
        }}
        onChange={(e) => {
          const links = [...(dashboard.state.links ?? [])];
          links[linkIndex] = { ...link, url: e.currentTarget.value };
          dashboard.setState({ links });
        }}
        onBlur={() => {
          if (oldUrl.current !== link.url) {
            linkEditActions.updateLink({
              dashboard,
              linkIndex,
              oldLink: { ...link, url: oldUrl.current },
              newLink: link,
              description: t('dashboard-scene.link-edit-actions.change-url', 'Change link URL'),
            });
          }
        }}
      />
    </Field>
  );
}

export function LinkTooltipInput({ linkEdit }: { linkEdit: LinkEdit }) {
  const { dashboard, link, linkIndex } = useLinkState(linkEdit);
  const oldTooltip = useRef(link?.tooltip ?? '');

  if (!link || link.type !== 'link') {
    return null;
  }

  return (
    <Field label={t('dashboard-scene.link-options.tooltip', 'Tooltip')} noMargin>
      <Input
        value={link.tooltip}
        placeholder={t('dashboard-scene.link-options.tooltip-placeholder', 'Open dashboard')}
        onFocus={() => {
          oldTooltip.current = link.tooltip;
        }}
        onChange={(e) => {
          const links = [...(dashboard.state.links ?? [])];
          links[linkIndex] = { ...link, tooltip: e.currentTarget.value };
          dashboard.setState({ links });
        }}
        onBlur={() => {
          if (oldTooltip.current !== link.tooltip) {
            linkEditActions.updateLink({
              dashboard,
              linkIndex,
              oldLink: { ...link, tooltip: oldTooltip.current },
              newLink: link,
              description: t('dashboard-scene.link-edit-actions.change-tooltip', 'Change link tooltip'),
            });
          }
        }}
      />
    </Field>
  );
}

export function LinkIconSelect({ linkEdit }: { linkEdit: LinkEdit }) {
  const { dashboard, link, linkIndex } = useLinkState(linkEdit);

  if (!link || link.type !== 'link') {
    return null;
  }

  return (
    <Field label={t('dashboard-scene.link-options.icon', 'Icon')} noMargin>
      <Select
        value={link.icon}
        options={linkIconOptions}
        onChange={(v: SelectableValue) => commitUpdate(dashboard, linkIndex, link, { ...link, icon: v.value })}
      />
    </Field>
  );
}

export function LinkAsDropdownSwitch({ linkEdit, id }: { linkEdit: LinkEdit; id?: string }) {
  const { dashboard, link, linkIndex } = useLinkState(linkEdit);
  if (!link) {
    return null;
  }
  return (
    <Switch
      id={id}
      value={link.asDropdown}
      onChange={(e) => commitUpdate(dashboard, linkIndex, link, { ...link, asDropdown: e.currentTarget.checked })}
    />
  );
}

export function LinkKeepTimeSwitch({ linkEdit, id }: { linkEdit: LinkEdit; id?: string }) {
  const { dashboard, link, linkIndex } = useLinkState(linkEdit);
  if (!link) {
    return null;
  }
  return (
    <Switch
      id={id}
      value={link.keepTime}
      onChange={(e) => commitUpdate(dashboard, linkIndex, link, { ...link, keepTime: e.currentTarget.checked })}
    />
  );
}

export function LinkIncludeVarsSwitch({ linkEdit, id }: { linkEdit: LinkEdit; id?: string }) {
  const { dashboard, link, linkIndex } = useLinkState(linkEdit);
  if (!link) {
    return null;
  }
  return (
    <Switch
      id={id}
      value={link.includeVars}
      onChange={(e) => commitUpdate(dashboard, linkIndex, link, { ...link, includeVars: e.currentTarget.checked })}
    />
  );
}

export function LinkTargetBlankSwitch({ linkEdit, id }: { linkEdit: LinkEdit; id?: string }) {
  const { dashboard, link, linkIndex } = useLinkState(linkEdit);
  if (!link) {
    return null;
  }
  return (
    <Switch
      id={id}
      value={link.targetBlank}
      onChange={(e) => commitUpdate(dashboard, linkIndex, link, { ...link, targetBlank: e.currentTarget.checked })}
    />
  );
}

export function LinkPlacementSwitch({ linkEdit, id }: { linkEdit: LinkEdit; id?: string }) {
  const { dashboard, link, linkIndex } = useLinkState(linkEdit);
  if (!link) {
    return null;
  }
  return (
    <Switch
      id={id}
      value={link.placement === 'inControlsMenu'}
      onChange={(e) =>
        commitUpdate(dashboard, linkIndex, link, {
          ...link,
          placement: e.currentTarget.checked ? 'inControlsMenu' : undefined,
        })
      }
    />
  );
}

import { useCallback, useRef } from 'react';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type DashboardLink } from '@grafana/schema';
import { Field, Input, Select, Switch, TagsInput } from '@grafana/ui';

import { type DashboardScene } from '../../scene/DashboardScene';
import { useEditPaneInputAutoFocus } from '../../scene/layouts-shared/utils';

import { type LinkEdit } from './LinkAddEditableElement';
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

export type TextLinkProp = 'title' | 'url' | 'tooltip';

const TEXT_LINK_PROP_CONFIG: Record<
  TextLinkProp,
  {
    labelKey: string;
    labelFallback: string;
    placeholderKey?: string;
    placeholderFallback?: string;
    blurDescriptionKey: string;
    blurDescriptionFallback: string;
    showIf: (link: DashboardLink) => boolean;
  }
> = {
  title: {
    labelKey: 'dashboard-scene.link-options.title',
    labelFallback: 'Title',
    blurDescriptionKey: 'dashboard-scene.link-edit-actions.change-title',
    blurDescriptionFallback: 'Change link title',
    showIf: () => true,
  },
  url: {
    labelKey: 'dashboard-scene.link-options.url',
    labelFallback: 'URL',
    blurDescriptionKey: 'dashboard-scene.link-edit-actions.change-url',
    blurDescriptionFallback: 'Change link URL',
    showIf: (link) => link.type === 'link',
  },
  tooltip: {
    labelKey: 'dashboard-scene.link-options.tooltip',
    labelFallback: 'Tooltip',
    placeholderKey: 'dashboard-scene.link-options.tooltip-placeholder',
    placeholderFallback: 'Open dashboard',
    blurDescriptionKey: 'dashboard-scene.link-edit-actions.change-tooltip',
    blurDescriptionFallback: 'Change link tooltip',
    showIf: (link) => link.type === 'link',
  },
};

export function LinkTextInput({
  linkEdit,
  prop,
  autoFocus,
}: {
  linkEdit: LinkEdit;
  prop: TextLinkProp;
  autoFocus?: boolean;
}) {
  const { dashboard, link, linkIndex } = useLinkState(linkEdit);
  const ref = useEditPaneInputAutoFocus({ autoFocus });

  const config = TEXT_LINK_PROP_CONFIG[prop];
  const oldValue = useRef(link?.[prop] ?? '');
  if (!link || !config.showIf(link)) {
    return null;
  }

  return (
    <Field label={t(config.labelKey, config.labelFallback)} noMargin>
      <Input
        ref={ref}
        value={link[prop] ?? ''}
        placeholder={
          config.placeholderKey && config.placeholderFallback
            ? t(config.placeholderKey, config.placeholderFallback)
            : undefined
        }
        onFocus={() => {
          oldValue.current = link[prop] ?? '';
        }}
        onChange={(e) => {
          const links = [...(dashboard.state.links ?? [])];
          links[linkIndex] = { ...link, [prop]: e.currentTarget.value };
          dashboard.setState({ links });
        }}
        onBlur={() => {
          if (oldValue.current !== (link[prop] ?? '')) {
            linkEditActions.updateLink({
              dashboard,
              linkIndex,
              oldLink: { ...link, [prop]: oldValue.current },
              newLink: link,
              description: t(config.blurDescriptionKey, config.blurDescriptionFallback),
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

export type BooleanLinkProp = 'asDropdown' | 'keepTime' | 'includeVars' | 'targetBlank';

export function LinkBooleanSwitch({ linkEdit, id, prop }: { linkEdit: LinkEdit; id?: string; prop: BooleanLinkProp }) {
  const { dashboard, link, linkIndex } = useLinkState(linkEdit);
  if (!link) {
    return null;
  }
  return (
    <Switch
      id={id}
      value={link[prop]}
      onChange={(e) => commitUpdate(dashboard, linkIndex, link, { ...link, [prop]: e.currentTarget.checked })}
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

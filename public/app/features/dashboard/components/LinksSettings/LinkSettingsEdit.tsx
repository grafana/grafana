import React, { useState } from 'react';
import { css } from 'emotion';
import { CollapsableSection, Button, TagsInput, Select, Field, Input, Switch } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { LinkSettingsMode } from '../DashboardSettings/LinksSettings';
import { DashboardLink, DashboardModel } from '../../state/DashboardModel';

const NEW_LINK = {
  icon: 'external link',
  title: '',
  tooltip: '',
  type: 'dashboards',
  url: '',
  asDropdown: false,
  tags: [],
  targetBlank: false,
  keepTime: false,
  includeVars: false,
} as DashboardLink;

const LINK_TYPE_OPTIONS = [
  { value: 'dashboards', label: 'Dashboards' },
  { value: 'link', label: 'Link' },
];

export const LINK_ICON_MAP: { [key: string]: string } = {
  'external link': 'external-link-alt',
  dashboard: 'apps',
  question: 'question-circle',
  info: 'info-circle',
  bolt: 'bolt',
  doc: 'file-alt',
  cloud: 'cloud',
};

const LINK_ICON_OPTIONS = Object.keys(LINK_ICON_MAP).map((key) => ({ label: key, value: key }));

type LinkSettingsEditProps = {
  mode: LinkSettingsMode;
  editLinkIdx: number | null;
  dashboard: DashboardModel;
  backToList: () => void;
};

export const LinkSettingsEdit: React.FC<LinkSettingsEditProps> = ({ mode, editLinkIdx, dashboard, backToList }) => {
  const [linkSettings, setLinkSettings] = useState(editLinkIdx !== null ? dashboard.links[editLinkIdx] : NEW_LINK);
  const onTagsChange = (tags: any[]) => {
    setLinkSettings((link) => ({ ...link, tags: tags }));
  };
  const onTypeChange = (selectedItem: SelectableValue) => {
    setLinkSettings((link) => ({ ...link, type: selectedItem.value }));
  };
  const onIconChange = (selectedItem: SelectableValue) => {
    setLinkSettings((link) => ({ ...link, icon: selectedItem.value }));
  };
  const onChange = (ev: React.FocusEvent<HTMLInputElement>) => {
    const target = ev.currentTarget;
    setLinkSettings((link) => ({
      ...link,
      [target.name]: target.type === 'checkbox' ? target.checked : target.value,
    }));
  };
  const addLink = () => {
    dashboard.links = [...dashboard.links, linkSettings];
    dashboard.updateSubmenuVisibility();
    backToList();
  };
  const updateLink = () => {
    dashboard.links.splice(editLinkIdx!, 1, linkSettings);
    backToList();
  };

  return (
    <div
      className={css`
        max-width: 600px;
      `}
    >
      <Field label="Type">
        <Select value={linkSettings.type} options={LINK_TYPE_OPTIONS} onChange={onTypeChange} />
      </Field>

      {linkSettings.type === 'dashboards' && (
        <>
          <Field label="With tags">
            <TagsInput tags={linkSettings.tags} placeholder="add tags" onChange={onTagsChange} />
          </Field>
          <Field label="As dropdown">
            <Switch name="asDropdown" value={linkSettings.asDropdown} onChange={onChange} />
          </Field>
          {linkSettings.asDropdown && (
            <Field label="Title">
              <Input name="title" value={linkSettings.title} onChange={onChange} />
            </Field>
          )}
        </>
      )}
      {linkSettings.type === 'link' && (
        <>
          <Field label="Url">
            <Input name="url" value={linkSettings.url} onChange={onChange} />
          </Field>

          <Field label="Title">
            <Input name="title" value={linkSettings.title} onChange={onChange} />
          </Field>

          <Field label="Tooltip">
            <Input name="tooltip" value={linkSettings.tooltip} onChange={onChange} placeholder="Open dashboard" />
          </Field>

          <Field label="Icon">
            <Select value={linkSettings.icon} options={LINK_ICON_OPTIONS} onChange={onIconChange} />
          </Field>
        </>
      )}
      <CollapsableSection label="Include" isOpen={true}>
        <Field label="Time range">
          <Switch name="keepTime" value={linkSettings.keepTime} onChange={onChange} />
        </Field>
        <Field label="Variable values">
          <Switch name="includeVars" value={linkSettings.includeVars} onChange={onChange} />
        </Field>
        <Field label="Open in new tab">
          <Switch name="targetBlank" value={linkSettings.targetBlank} onChange={onChange} />
        </Field>
      </CollapsableSection>
      {mode === 'new' && <Button onClick={addLink}>Add</Button>}
      {mode === 'edit' && <Button onClick={updateLink}>Update</Button>}
    </div>
  );
};

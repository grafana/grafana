import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { CollapsableSection, TagsInput, Select, Field, Input, Checkbox, Button, IconName } from '@grafana/ui';

import { DashboardLink, DashboardModel } from '../../state/DashboardModel';

export const newLink: DashboardLink = {
  icon: 'external link',
  title: 'New link',
  tooltip: '',
  type: 'dashboards',
  url: '',
  asDropdown: false,
  tags: [],
  targetBlank: false,
  keepTime: false,
  includeVars: false,
};

const linkTypeOptions = [
  { value: 'dashboards', label: 'Dashboards' },
  { value: 'link', label: 'Link' },
];

export const linkIconMap: Record<string, IconName | undefined> = {
  'external link': 'external-link-alt',
  dashboard: 'apps',
  question: 'question-circle',
  info: 'info-circle',
  bolt: 'bolt',
  doc: 'file-alt',
  cloud: 'cloud',
};

const linkIconOptions = Object.keys(linkIconMap).map((key) => ({ label: key, value: key }));

type LinkSettingsEditProps = {
  editLinkIdx: number;
  dashboard: DashboardModel;
  onGoBack: () => void;
};

export const LinkSettingsEdit: React.FC<LinkSettingsEditProps> = ({ editLinkIdx, dashboard, onGoBack }) => {
  const [linkSettings, setLinkSettings] = useState(editLinkIdx !== null ? dashboard.links[editLinkIdx] : newLink);

  const onUpdate = (link: DashboardLink) => {
    const links = [...dashboard.links];
    links.splice(editLinkIdx, 1, link);
    dashboard.links = links;
    setLinkSettings(link);
  };

  const onTagsChange = (tags: string[]) => {
    onUpdate({ ...linkSettings, tags: tags });
  };

  const onTypeChange = (selectedItem: SelectableValue) => {
    const update = { ...linkSettings, type: selectedItem.value };

    // clear props that are no longe revant for this type
    if (update.type === 'dashboards') {
      update.url = '';
      update.tooltip = '';
    } else {
      update.tags = [];
    }

    onUpdate(update);
  };

  const onIconChange = (selectedItem: SelectableValue) => {
    onUpdate({ ...linkSettings, icon: selectedItem.value });
  };

  const onChange = (ev: React.FocusEvent<HTMLInputElement>) => {
    const target = ev.currentTarget;
    onUpdate({
      ...linkSettings,
      [target.name]: target.type === 'checkbox' ? target.checked : target.value,
    });
  };

  const isNew = linkSettings.title === newLink.title;

  return (
    <div style={{ maxWidth: '600px' }}>
      <Field label="Title">
        <Input name="title" id="title" value={linkSettings.title} onChange={onChange} autoFocus={isNew} />
      </Field>
      <Field label="Type">
        <Select inputId="link-type-input" value={linkSettings.type} options={linkTypeOptions} onChange={onTypeChange} />
      </Field>
      {linkSettings.type === 'dashboards' && (
        <>
          <Field label="With tags">
            <TagsInput tags={linkSettings.tags} onChange={onTagsChange} />
          </Field>
        </>
      )}
      {linkSettings.type === 'link' && (
        <>
          <Field label="URL">
            <Input name="url" value={linkSettings.url} onChange={onChange} />
          </Field>
          <Field label="Tooltip">
            <Input name="tooltip" value={linkSettings.tooltip} onChange={onChange} placeholder="Open dashboard" />
          </Field>
          <Field label="Icon">
            <Select value={linkSettings.icon} options={linkIconOptions} onChange={onIconChange} />
          </Field>
        </>
      )}
      <CollapsableSection label="Options" isOpen={true}>
        {linkSettings.type === 'dashboards' && (
          <Field>
            <Checkbox label="Show as dropdown" name="asDropdown" value={linkSettings.asDropdown} onChange={onChange} />
          </Field>
        )}
        <Field>
          <Checkbox
            label="Include current time range"
            name="keepTime"
            value={linkSettings.keepTime}
            onChange={onChange}
          />
        </Field>
        <Field>
          <Checkbox
            label="Include current template variable values"
            name="includeVars"
            value={linkSettings.includeVars}
            onChange={onChange}
          />
        </Field>
        <Field>
          <Checkbox
            label="Open link in new tab"
            name="targetBlank"
            value={linkSettings.targetBlank}
            onChange={onChange}
          />
        </Field>
      </CollapsableSection>
      <Button onClick={onGoBack}>Apply</Button>
    </div>
  );
};

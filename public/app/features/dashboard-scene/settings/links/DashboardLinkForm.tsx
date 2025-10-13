import * as React from 'react';

import { SelectableValue } from '@grafana/data';
import { DashboardLink } from '@grafana/schema';
import { CollapsableSection, TagsInput, Select, Field, Input, Checkbox, Button } from '@grafana/ui';

import { LINK_ICON_MAP, NEW_LINK } from './utils';

const linkTypeOptions = [
  { value: 'dashboards', label: 'Dashboards' },
  { value: 'link', label: 'Link' },
];

const linkIconOptions = Object.keys(LINK_ICON_MAP).map((key) => ({ label: key, value: key }));

interface DashboardLinkFormProps {
  link: DashboardLink;
  onUpdate: (link: DashboardLink) => void;
  onGoBack: () => void;
}

export function DashboardLinkForm({ link, onUpdate, onGoBack }: DashboardLinkFormProps) {
  const onTagsChange = (tags: string[]) => {
    onUpdate({ ...link, tags: tags });
  };

  const onTypeChange = (selectedItem: SelectableValue) => {
    const update = { ...link, type: selectedItem.value };

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
    onUpdate({ ...link, icon: selectedItem.value });
  };

  const onChange = (ev: React.FocusEvent<HTMLInputElement>) => {
    const target = ev.currentTarget;
    onUpdate({
      ...link,
      [target.name]: target.type === 'checkbox' ? target.checked : target.value,
    });
  };

  const isNew = link.title === NEW_LINK.title;

  return (
    <div style={{ maxWidth: '600px' }}>
      <Field label="Title">
        <Input name="title" id="title" value={link.title} onChange={onChange} autoFocus={isNew} />
      </Field>
      <Field label="Type">
        <Select inputId="link-type-input" value={link.type} options={linkTypeOptions} onChange={onTypeChange} />
      </Field>
      {link.type === 'dashboards' && (
        <>
          <Field label="With tags">
            <TagsInput tags={link.tags} onChange={onTagsChange} />
          </Field>
        </>
      )}
      {link.type === 'link' && (
        <>
          <Field label="URL">
            <Input name="url" value={link.url} onChange={onChange} />
          </Field>
          <Field label="Tooltip">
            <Input name="tooltip" value={link.tooltip} onChange={onChange} placeholder="Open dashboard" />
          </Field>
          <Field label="Icon">
            <Select value={link.icon} options={linkIconOptions} onChange={onIconChange} />
          </Field>
        </>
      )}
      <CollapsableSection label="Options" isOpen={true}>
        {link.type === 'dashboards' && (
          <Field>
            <Checkbox label="Show as dropdown" name="asDropdown" value={link.asDropdown} onChange={onChange} />
          </Field>
        )}
        <Field>
          <Checkbox label="Include current time range" name="keepTime" value={link.keepTime} onChange={onChange} />
        </Field>
        <Field>
          <Checkbox
            label="Include current template variable values"
            name="includeVars"
            value={link.includeVars}
            onChange={onChange}
          />
        </Field>
        <Field>
          <Checkbox label="Open link in new tab" name="targetBlank" value={link.targetBlank} onChange={onChange} />
        </Field>
      </CollapsableSection>
      <Button variant="secondary" onClick={onGoBack}>
        Back to list
      </Button>
    </div>
  );
}

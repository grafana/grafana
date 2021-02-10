import React, { useState } from 'react';
import _ from 'lodash';
import { Button, Icon, Tag, TagsInput, Select, InlineField, Input, InlineSwitch } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { DashboardLink, DashboardModel } from '../../state/DashboardModel';

interface Props {
  dashboard: DashboardModel;
}

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

const LINK_ICON_OPTIONS = Object.entries(LINK_ICON_MAP).map(([key, value]) => ({ label: key, value }));
export const LinksSettings: React.FC<Props> = ({ dashboard }) => {
  const [mode, setMode] = useState<'list' | 'new' | 'edit'>('list');
  const [link, setLink] = useState<DashboardLink>(NEW_LINK);

  const backToList = () => {
    setMode('list');
  };
  const setupNew = () => {
    setLink(NEW_LINK);
    setMode('new');
  };
  const editLink = (link: DashboardLink) => {
    setLink(link);
    setMode('edit');
  };
  const moveLink = (idx: number, direction: number) => {
    // @ts-ignore
    _.move(dashboard.links, idx, idx + direction);
  };
  const duplicateLink = (link: DashboardLink, idx: number) => {
    dashboard.links.splice(idx, 0, link);
    dashboard.updateSubmenuVisibility();
  };
  const addLink = () => {
    dashboard.links = [...dashboard.links, link];
    backToList();
    dashboard.updateSubmenuVisibility();
  };
  const updateLink = () => {
    // TODO: update the link!
    // dashboard.links = _.cloneDeep(dashboard.links);
    backToList();
  };
  const deleteLink = (link: DashboardLink, idx: number) => {
    dashboard.links.splice(idx, 1);
    dashboard.updateSubmenuVisibility();
  };

  const onTagsChange = (tags: any[]) => {
    console.log(tags);
  };
  const onTypeChange = (value: SelectableValue) => {
    console.log(value);
  };
  const onIconChange = (value: SelectableValue) => {
    console.log(value);
  };
  const onChange = (ev: React.FocusEvent<HTMLInputElement>) => {
    setLink((link) => ({ ...link, [ev.currentTarget.name]: ev.currentTarget.value }));
  };

  if (mode === 'list') {
    return (
      <div>
        <LinkSettingsHeader onNavClick={backToList} onBtnClick={setupNew} mode={mode} />
        {dashboard.links.length === 0 ? (
          <EmptyListCTA
            onClick={setupNew}
            title="There are no dashboard links added yet"
            buttonIcon="link"
            buttonTitle="Add Dashboard Link"
            infoBoxTitle="What are Dashboard Links?"
            infoBox={{
              __html:
                '<p>Dashboard Links allow you to place links to other dashboards and web sites directly below the dashboard header.</p>',
            }}
          />
        ) : (
          <table className="filter-table filter-table--hover">
            <thead>
              <tr>
                <th>Type</th>
                <th>Info</th>
                <th colSpan={3} />
              </tr>
            </thead>
            <tbody>
              {dashboard.links.map((link, idx) => (
                <tr key={idx}>
                  <td className="pointer" onClick={() => editLink(link)}>
                    <Icon name="external-link-alt" />
                    {link.type}
                  </td>
                  <td>
                    {link.title && <div>{link.title}</div>}
                    {!link.title && link.url ? <div>{link.url}</div> : null}
                    {!link.title && link.tags ? link.tags.map((tag) => <Tag name={tag} key={tag} />) : null}
                  </td>
                  <td style={{ width: '1%' }}>
                    {idx !== 0 && <Icon name="arrow-up" onClick={() => moveLink(idx, -1)} />}
                  </td>
                  <td style={{ width: '1%' }}>
                    {idx !== dashboard.links.length && <Icon name="arrow-down" onClick={() => moveLink(idx, 1)} />}
                  </td>
                  <td style={{ width: '1%' }}>
                    <Button icon="copy" onClick={() => duplicateLink(link, idx)} />
                  </td>
                  <td style={{ width: '1%' }}>
                    <Button icon="trash-alt" onClick={() => deleteLink(link, idx)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <>
      <LinkSettingsHeader onNavClick={backToList} onBtnClick={setupNew} mode={mode} />
      <div className="gf-form">
        <InlineField label="Type">
          <Select value={link.type} options={LINK_TYPE_OPTIONS} onChange={onTypeChange} />
        </InlineField>

        {link.type === 'dashboards' && (
          <>
            <InlineField label="With tags">
              <TagsInput tags={link.tags} placeholder="add tags" onChange={onTagsChange} />
            </InlineField>
            <InlineField label="As dropdown">
              <InlineSwitch name="asDropdown" value={link.asDropdown} onChange={onChange} />
            </InlineField>
            {link.asDropdown && (
              <InlineField label="Title">
                <Input name="title" value={link.title} onChange={onChange} />
              </InlineField>
            )}
          </>
        )}
        {link.type === 'link' && (
          <>
            <InlineField label="Url">
              <Input name="url" value={link.url} onChange={onChange} />
            </InlineField>

            <InlineField label="Title">
              <Input name="title" value={link.title} onChange={onChange} />
            </InlineField>

            <InlineField label="Tooltip">
              <Input name="tooltip" value={link.tooltip} onChange={onChange} placeholder="Open dashboard" />
            </InlineField>

            <InlineField label="Icon">
              <Select options={LINK_ICON_OPTIONS} onChange={onIconChange} />
            </InlineField>
          </>
        )}
      </div>
      <div className="gf-form-group">
        <h5 className="section-heading">Include</h5>
        <InlineField label="Time range">
          <InlineSwitch name="keepTime" value={link.keepTime} onChange={onChange} />
        </InlineField>
        <InlineField label="Variable values">
          <InlineSwitch name="includeVars" value={link.includeVars} onChange={onChange} />
        </InlineField>
        <InlineField label="Open in new tab">
          <InlineSwitch name="targetBlank" value={link.targetBlank} onChange={onChange} />
        </InlineField>
      </div>
      {mode === 'new' && <Button onClick={addLink}>Add</Button>}
      {mode === 'edit' && <Button onClick={updateLink}>Update</Button>}
    </>
  );
};

const LinkSettingsHeader = ({
  onNavClick,
  onBtnClick,
  mode,
}: {
  onNavClick: () => void;
  onBtnClick: () => void;
  mode: 'list' | 'new' | 'edit';
}) => {
  const isEditing = mode !== 'list';

  return (
    <>
      <h3 className="dashboard-settings__header">
        <span onClick={onNavClick} className={isEditing ? 'pointer' : ''}>
          Dashboard Links
        </span>
        {isEditing && (
          <span>
            <Icon name="angle-right" /> {mode === 'new' ? 'New' : 'Edit'}
          </span>
        )}
      </h3>
      {/* TODO: if links.length > 0 */}
      {!isEditing && <Button onClick={onBtnClick}>New</Button>}
    </>
  );
};

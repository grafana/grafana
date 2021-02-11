import React, { useState } from 'react';
import _ from 'lodash';
import { css } from 'emotion';
import { CollapsableSection, Button, Icon, Tag, TagsInput, Select, Field, Input, Switch, useTheme } from '@grafana/ui';
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
  const [editLinkIdx, seteditLinkIdx] = useState(0);
  // @ts-ignore
  const [renderCount, setRenderCount] = useState(0);
  const theme = useTheme();

  const backToList = () => {
    setMode('list');
  };
  const setupNew = () => {
    setLink(NEW_LINK);
    setMode('new');
  };
  const editLink = (link: DashboardLink, idx: number) => {
    setLink(link);
    seteditLinkIdx(idx);
    setMode('edit');
  };
  const moveLink = (idx: number, direction: number) => {
    // @ts-ignore
    _.move(dashboard.links, idx, idx + direction);
    setRenderCount((renderCount) => renderCount + 1);
  };
  const duplicateLink = (link: DashboardLink, idx: number) => {
    dashboard.links.splice(idx, 0, link);
    dashboard.updateSubmenuVisibility();
    setRenderCount((renderCount) => renderCount + 1);
  };
  const addLink = () => {
    dashboard.links = [...dashboard.links, link];
    dashboard.updateSubmenuVisibility();
    backToList();
  };
  const updateLink = () => {
    dashboard.links.splice(editLinkIdx, 1, link);
    backToList();
  };
  const deleteLink = (link: DashboardLink, idx: number) => {
    dashboard.links.splice(idx, 1);
    dashboard.updateSubmenuVisibility();
    setRenderCount((renderCount) => renderCount + 1);
  };

  const onTagsChange = (tags: any[]) => {
    setLink((link) => ({ ...link, tags: tags }));
  };
  const onTypeChange = (selectedItem: SelectableValue) => {
    setLink((link) => ({ ...link, type: selectedItem.value }));
  };
  const onIconChange = (selectedItem: SelectableValue) => {
    setLink((link) => ({ ...link, icon: selectedItem.value }));
  };
  const onChange = (ev: React.FocusEvent<HTMLInputElement>) => {
    const target = ev.currentTarget;
    setLink((link) => ({ ...link, [target.name]: target.value }));
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
                  <td className="pointer" onClick={() => editLink(link, idx)}>
                    <Icon name="external-link-alt" />
                    {link.type}
                  </td>
                  <td>
                    {link.title && <div>{link.title}</div>}
                    {!link.title && link.url ? <div>{link.url}</div> : null}
                    {!link.title && link.tags
                      ? link.tags.map((tag, idx) => (
                          <Tag
                            name={tag}
                            key={tag}
                            className={
                              idx !== 0
                                ? css`
                                    margin-left: ${theme.spacing.xs};
                                  `
                                : ''
                            }
                          />
                        ))
                      : null}
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
      <div
        className={css`
          max-width: 600px;
        `}
      >
        <Field label="Type">
          <Select value={link.type} options={LINK_TYPE_OPTIONS} onChange={onTypeChange} />
        </Field>

        {link.type === 'dashboards' && (
          <>
            <Field label="With tags">
              <TagsInput tags={link.tags} placeholder="add tags" onChange={onTagsChange} />
            </Field>
            <Field label="As dropdown">
              <Switch name="asDropdown" value={link.asDropdown} onChange={onChange} />
            </Field>
            {link.asDropdown && (
              <Field label="Title">
                <Input name="title" value={link.title} onChange={onChange} />
              </Field>
            )}
          </>
        )}
        {link.type === 'link' && (
          <>
            <Field label="Url">
              <Input name="url" value={link.url} onChange={onChange} />
            </Field>

            <Field label="Title">
              <Input name="title" value={link.title} onChange={onChange} />
            </Field>

            <Field label="Tooltip">
              <Input name="tooltip" value={link.tooltip} onChange={onChange} placeholder="Open dashboard" />
            </Field>

            <Field label="Icon">
              <Select options={LINK_ICON_OPTIONS} onChange={onIconChange} />
            </Field>
          </>
        )}
        <CollapsableSection label="Include" isOpen={true}>
          <Field label="Time range">
            <Switch name="keepTime" value={link.keepTime} onChange={onChange} />
          </Field>
          <Field label="Variable values">
            <Switch name="includeVars" value={link.includeVars} onChange={onChange} />
          </Field>
          <Field label="Open in new tab">
            <Switch name="targetBlank" value={link.targetBlank} onChange={onChange} />
          </Field>
        </CollapsableSection>
        {mode === 'new' && <Button onClick={addLink}>Add</Button>}
        {mode === 'edit' && <Button onClick={updateLink}>Update</Button>}
      </div>
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

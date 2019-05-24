// Libraries
import React, { FC, ChangeEvent, useState } from 'react';

// Components
import { PanelOptionsGroup, PanelDrillDownLink, FormField } from '@grafana/ui';

export interface Props {
  value: PanelDrillDownLink[];
  onChange: (links: PanelDrillDownLink[]) => void;
}

export const PanelLinksEditor: FC<Props> = React.memo(({ value, onChange }) => {
  const onAdd = () => {
    onChange([...value, { url: '', title: '' }]);
  };

  const onLinkChanged = (linkIndex: number, newLink: PanelDrillDownLink) => {
    onChange(
      value.map((item, listIndex) => {
        if (linkIndex === listIndex) {
          return newLink;
        }
        return item;
      })
    );
  };

  const onRemove = (link: PanelDrillDownLink) => {
    onChange(value.filter(item => item !== link));
  };

  return (
    <PanelOptionsGroup title="Drilldown links" onAdd={onAdd}>
      {value.map((link, index) => (
        <LinkEditor key={index.toString()} index={index} value={link} onChange={onLinkChanged} onRemove={onRemove} />
      ))}
    </PanelOptionsGroup>
  );
});

export interface LinkEditor {
  index: number;
  value: PanelDrillDownLink;
  onChange: (index: number, link: PanelDrillDownLink) => void;
  onRemove: (link: PanelDrillDownLink) => void;
}

export const LinkEditor: FC<LinkEditor> = React.memo(({ index, value, onChange, onRemove }) => {
  const [linkUrl, setLinkUrl] = useState(value.url);
  const [title, setTitle] = useState(value.title);

  const onUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    setLinkUrl(event.target.value);
  };

  const onUrlBlur = () => {
    onChange(index, { ...value, url: linkUrl });
  };

  const onTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value);
  };

  const onTitleBlur = () => {
    onChange(index, { ...value, title: title });
  };

  const onRemoveClick = () => {
    onRemove(value);
  };

  return (
    <div className="gf-form-inline">
      <FormField
        label="Title"
        value={title}
        onChange={onTitleChange}
        onBlur={onTitleBlur}
        inputWidth={15}
        labelWidth={6}
      />
      <div className="gf-form">
        <label className="gf-form-label">URL</label>
      </div>
      <div className="gf-form gf-form--grow">
        <input
          placeholder="http://your-grafana.com/d/000000010/annotations"
          type="text"
          className="gf-form-input"
          value={linkUrl}
          onChange={onUrlChange}
          onBlur={onUrlBlur}
        />
      </div>
      <div className="gf-form">
        <button className="gf-form-label gf-form-label--btn" onClick={onRemoveClick}>
          <i className="fa fa-times" />
        </button>
      </div>
    </div>
  );
});

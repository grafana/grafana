import React, { FC, useState, ChangeEvent } from 'react';
import { PanelDrillDownLink } from '../../index';
import { FormField, Switch } from '../index';

interface DrilldownLinkEditorProps {
  index: number;
  value: PanelDrillDownLink;
  onChange: (index: number, link: PanelDrillDownLink) => void;
  onRemove: (link: PanelDrillDownLink) => void;
}

export const DrilldownLinkEditor: FC<DrilldownLinkEditorProps> = React.memo(({ index, value, onChange, onRemove }) => {
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

  const onOpenInNewTabChanged = () => {
    onChange(index, { ...value, targetBlank: !value.targetBlank });
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
      <Switch label="Open in new tab" checked={value.targetBlank || false} onChange={onOpenInNewTabChanged} />
      <div className="gf-form">
        <button className="gf-form-label gf-form-label--btn" onClick={onRemoveClick}>
          <i className="fa fa-times" />
        </button>
      </div>
    </div>
  );
});

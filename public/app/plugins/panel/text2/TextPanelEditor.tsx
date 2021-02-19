// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Components
import { PanelOptionsGroup, Select } from '@grafana/ui';
import { PanelEditorProps, SelectableValue } from '@grafana/data';

// Types
import { TextOptions, TextMode } from './types';

export class TextPanelEditor extends PureComponent<PanelEditorProps<TextOptions>> {
  modes: Array<SelectableValue<TextMode>> = [
    { value: 'markdown', label: 'Markdown' },
    { value: 'text', label: 'Text' },
    { value: 'html', label: 'HTML' },
  ];

  onModeChange = (item: SelectableValue<TextMode>) =>
    this.props.onOptionsChange({ ...this.props.options, mode: item.value! });

  onContentChange = (evt: ChangeEvent<HTMLTextAreaElement>) => {
    this.props.onOptionsChange({ ...this.props.options, content: (evt.target as any).value });
  };

  render() {
    const { mode, content } = this.props.options;

    return (
      <PanelOptionsGroup title="Text">
        <div className="gf-form-inline">
          <div className="gf-form">
            <span className="gf-form-label">Mode</span>
            <Select onChange={this.onModeChange} value={this.modes.find(e => mode === e.value)} options={this.modes} />
          </div>
        </div>
        <textarea value={content} onChange={this.onContentChange} className="gf-form-input" rows={10} />
      </PanelOptionsGroup>
    );
  }
}

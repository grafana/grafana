import React, { PureComponent } from 'react';
import { PanelEditorProps, PanelOptionsGroup, Select, SelectOptionItem } from '@grafana/ui';

import { TextOptions } from './types';

export class TextPanelEditor extends PureComponent<PanelEditorProps<TextOptions>> {
  modes: SelectOptionItem[] = [
    { value: 'markdown', label: 'Markdown' },
    { value: 'text', label: 'Text' },
    { value: 'html', label: 'HTML' },
  ];

  onModeChange = (item: SelectOptionItem) => this.props.onChange({ ...this.props.options, mode: item.value });

  onContentChange = evt => this.props.onChange({ ...this.props.options, content: (event.target as any).value });

  render() {
    const { mode, content } = this.props.options;

    return (
      <PanelOptionsGroup title="Text">
        <div className="gf-form">
          <span className="gf-form-label">Mode</span>
          <Select onChange={this.onModeChange} value={this.modes.find(e => mode === e.value)} options={this.modes} />
        </div>

        {/* TODO: <code-editor */}
        <textarea value={content} onChange={this.onContentChange} className="gf-form-input" rows={10} />
      </PanelOptionsGroup>
    );
  }
}

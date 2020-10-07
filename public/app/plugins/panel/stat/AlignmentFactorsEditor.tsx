import React, { PureComponent } from 'react';
import { withTheme, Button, Label, Themeable } from '@grafana/ui';
import { StandardEditorProps, DisplayValueAlignmentFactors, StandardEditorContext } from '@grafana/data';
import { AlignmentFactorTextEditor } from './AlignmentFactorText';

export interface AlignmentFactorsEditorOptions {
  getStandardAlignmentFactors: (ctx: StandardEditorContext<any>) => DisplayValueAlignmentFactors;
}

type Props = StandardEditorProps<DisplayValueAlignmentFactors, any, AlignmentFactorsEditorOptions> & Themeable;

class UnthemedAlignmentFactorsEditor extends PureComponent<Props> {
  onStartEditing = () => {
    const { item, context } = this.props;
    const factors = item.settings?.getFieldDisplay(context);
    this.props.onChange({ ...factors });
  };

  onStopEditing = () => {
    this.props.onChange(undefined);
  };

  onFactorsChanged = (update: Partial<DisplayValueAlignmentFactors>) => {
    const { value, onChange } = this.props;
    onChange({
      ...value,
      ...update,
    });
  };

  render() {
    const { value } = this.props;
    if (!value) {
      return (
        <div>
          <Button onClick={this.onStartEditing} variant="secondary" size="md">
            Use explicit factors
          </Button>
        </div>
      );
    }

    return (
      <div>
        <Label>Title</Label>
        <AlignmentFactorTextEditor value={value.title} onChange={v => this.onFactorsChanged({ title: v })} />
        <Label>Text</Label>
        <AlignmentFactorTextEditor value={value.text} onChange={v => this.onFactorsChanged({ text: v })} />
        <Label>Prefix</Label>
        <AlignmentFactorTextEditor value={value.prefix} onChange={v => this.onFactorsChanged({ prefix: v })} />
        <Label>Suffix</Label>
        <AlignmentFactorTextEditor value={value.suffix} onChange={v => this.onFactorsChanged({ suffix: v })} />
        <br />
        <Button onClick={this.onStopEditing} variant="secondary" size="md">
          Use default factors
        </Button>
      </div>
    );
  }
}

export const AlignmentFactorsEditor = withTheme(UnthemedAlignmentFactorsEditor);

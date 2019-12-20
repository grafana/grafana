import React, { PureComponent } from 'react';
import { Scale, validateScale, ScaleMode, Threshold, SelectableValue } from '@grafana/data';
import { PanelOptionsGroup } from '../PanelOptionsGroup/PanelOptionsGroup';
import { ThresholdsEditor } from './ThresholdsEditor';
import { Select } from '../Select/Select';
import { getTheme } from '../../themes';

export interface Props {
  scale?: Scale;
  onChange: (scale: Scale) => void;
}

const modes: Array<SelectableValue<ScaleMode>> = [
  { value: ScaleMode.absolute, label: 'Absolute', description: 'Set thresholds against the absolute values' },
  { value: ScaleMode.relative, label: 'Relative', description: 'Thresholds are percent between min/max' },
  { value: ScaleMode.schema, label: 'Scheme', description: 'Use a predefined color scheme' },
];

export class ScaleEditor extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  getCurrent = () => {
    const scale = this.props.scale
      ? { ...this.props.scale }
      : {
          mode: ScaleMode.relative,
          thresholds: [
            { value: -Infinity, color: 'green' },
            { value: 80, color: 'red' },
          ],
        };
    validateScale(scale);
    return scale as Scale;
  };

  onThresholdsChanged = (thresholds: Threshold[]) => {
    this.props.onChange({
      ...this.getCurrent(),
      thresholds,
    });
  };

  onModeChanged = (item: SelectableValue<ScaleMode>) => {
    this.props.onChange({
      ...this.getCurrent(),
      mode: item.value ?? ScaleMode.relative,
    });
  };

  render() {
    const scale = this.getCurrent();
    return (
      <PanelOptionsGroup title="Scale">
        <ThresholdsEditor
          theme={getTheme()}
          thresholds={scale.thresholds}
          onChange={this.onThresholdsChanged}
          isPercent={scale.mode !== ScaleMode.absolute}
        />
        <Select options={modes} value={modes.filter(m => m.value === scale.mode)} onChange={this.onModeChanged} />
        {scale.mode === ScaleMode.schema && <div>TODO... picker...</div>}
      </PanelOptionsGroup>
    );
  }
}

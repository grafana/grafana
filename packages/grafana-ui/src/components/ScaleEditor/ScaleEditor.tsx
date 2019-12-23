import React, { PureComponent } from 'react';
import { Scale, ScaleMode, ColorScheme, Threshold, SelectableValue, validateScale } from '@grafana/data';
import { PanelOptionsGroup } from '../PanelOptionsGroup/PanelOptionsGroup';
import { ThresholdsEditor } from './ThresholdsEditor';
import { Select } from '../Select/Select';
import { getTheme } from '../../themes';

export interface Props {
  scale?: Scale;
  onChange: (scale: Scale) => void;
}

const modes: Array<SelectableValue<ScaleMode>> = [
  { value: ScaleMode.Absolute, label: 'Absolute', description: 'Set thresholds against the absolute values' },
  { value: ScaleMode.Relative, label: 'Relative', description: 'Thresholds are percent between min/max' },
  { value: ScaleMode.Scheme, label: 'Scheme', description: 'Use a predefined color scheme' },
];

const schemes = Object.values(ColorScheme).map(s => {
  return { value: s, label: s };
});

export class ScaleEditor extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  getCurrent = () => {
    const scale = this.props.scale
      ? { ...this.props.scale }
      : {
          mode: ScaleMode.Absolute,
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
    const val = {
      ...this.getCurrent(),
      mode: item.value ?? ScaleMode.Relative,
    };
    validateScale(val);
    this.props.onChange(val);
  };

  onSchemeChanged = (item: SelectableValue<ColorScheme>) => {
    this.props.onChange({
      ...this.getCurrent(),
      scheme: item.value,
    });
  };

  render() {
    const scale = this.getCurrent();
    return (
      <PanelOptionsGroup title="Thresholds">
        <div>
          <ThresholdsEditor
            theme={getTheme()}
            thresholds={scale.thresholds}
            onChange={this.onThresholdsChanged}
            isPercent={scale.mode !== ScaleMode.Absolute}
          />
          {false && (
            <div>
              <Select options={modes} value={modes.filter(m => m.value === scale.mode)} onChange={this.onModeChanged} />
              {scale.mode === ScaleMode.Scheme && (
                <div>
                  <Select
                    options={schemes}
                    value={schemes.filter(s => s.value === scale.scheme)}
                    onChange={this.onSchemeChanged}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </PanelOptionsGroup>
    );
  }
}

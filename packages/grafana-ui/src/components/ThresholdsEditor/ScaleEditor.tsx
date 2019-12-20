import React, { PureComponent } from 'react';
import { Scale, validateScale, ScaleMode, ColorScheme, Threshold, SelectableValue, validateScale } from '@grafana/data';
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
  { value: ScaleMode.scheme, label: 'Scheme', description: 'Use a predefined color scheme' },
];

const schemas = Object.values(ColorScheme).map(s => {
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
    const val = {
      ...this.getCurrent(),
      mode: item.value ?? ScaleMode.relative,
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
      <PanelOptionsGroup title="Scale">
        <div>
          <ThresholdsEditor
            theme={getTheme()}
            thresholds={scale.thresholds}
            onChange={this.onThresholdsChanged}
            isPercent={scale.mode !== ScaleMode.absolute}
          />
          <Select options={modes} value={modes.filter(m => m.value === scale.mode)} onChange={this.onModeChanged} />
          {scale.mode === ScaleMode.schema && (
            <div>
              <Select
                options={schemas}
                value={schemas.filter(s => s.value === scale.scheme)}
                onChange={this.onSchemeChanged}
              />
            </div>
          )}
        </div>
      </PanelOptionsGroup>
    );
  }
}

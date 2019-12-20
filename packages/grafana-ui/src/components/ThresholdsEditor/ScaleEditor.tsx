import React, { PureComponent } from 'react';
import { Scale, validateScale, ScaleMode, Threshold } from '@grafana/data';
import { PanelOptionsGroup } from '../PanelOptionsGroup/PanelOptionsGroup';
import { ThresholdsEditor } from './ThresholdsEditor';
import { getTheme } from '../../themes';

export interface Props {
  scale?: Scale;
  onChange: (scale: Scale) => void;
}

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
      </PanelOptionsGroup>
    );
  }
}

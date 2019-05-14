import React, { PureComponent, ChangeEvent } from 'react';
import { Threshold } from '../../types';
import { colors } from '../../utils';
import { ThemeContext } from '../../themes';
import { getColorFromHexRgbOrName } from '../../utils';
import { Input } from '../Input/Input';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import { PanelOptionsGroup } from '../PanelOptionsGroup/PanelOptionsGroup';

export interface Props {
  thresholds: Threshold[];
  onChange: (thresholds: Threshold[]) => void;
}

interface State {
  thresholds: Threshold[];
}

export class ThresholdsEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const addDefaultThreshold = this.props.thresholds.length === 0;
    const thresholds: Threshold[] = addDefaultThreshold
      ? [{ index: 0, value: -Infinity, color: colors[0] }]
      : props.thresholds;
    this.state = { thresholds };

    if (addDefaultThreshold) {
      this.onChange();
    }
  }

  onAddThreshold = (index: number) => {
    const { thresholds } = this.state;
    const maxValue = 100;
    const minValue = 0;

    if (index === 0) {
      return;
    }

    const newThresholds = thresholds.map(threshold => {
      if (threshold.index >= index) {
        const index = threshold.index + 1;
        threshold = { ...threshold, index };
      }
      return threshold;
    });

    // Setting value to a value between the previous thresholds
    const beforeThreshold = newThresholds.filter(t => t.index === index - 1 && t.index !== 0)[0];
    const afterThreshold = newThresholds.filter(t => t.index === index + 1 && t.index !== 0)[0];
    const beforeThresholdValue = beforeThreshold !== undefined ? beforeThreshold.value : minValue;
    const afterThresholdValue = afterThreshold !== undefined ? afterThreshold.value : maxValue;
    const value = afterThresholdValue - (afterThresholdValue - beforeThresholdValue) / 2;

    // Set a color
    const color = colors.filter(c => !newThresholds.some(t => t.color === c))[1];

    this.setState(
      {
        thresholds: this.sortThresholds([
          ...newThresholds,
          {
            color,
            index,
            value: value as number,
          },
        ]),
      },
      () => this.onChange()
    );
  };

  onRemoveThreshold = (threshold: Threshold) => {
    if (threshold.index === 0) {
      return;
    }

    this.setState(
      prevState => {
        const newThresholds = prevState.thresholds.map(t => {
          if (t.index > threshold.index) {
            const index = t.index - 1;
            t = { ...t, index };
          }
          return t;
        });

        return {
          thresholds: newThresholds.filter(t => t !== threshold),
        };
      },
      () => this.onChange()
    );
  };

  onChangeThresholdValue = (event: ChangeEvent<HTMLInputElement>, threshold: Threshold) => {
    if (threshold.index === 0) {
      return;
    }

    const { thresholds } = this.state;
    const cleanValue = event.target.value.replace(/,/g, '.');
    const parsedValue = parseFloat(cleanValue);
    const value = isNaN(parsedValue) ? '' : parsedValue;

    const newThresholds = thresholds.map(t => {
      if (t === threshold && t.index !== 0) {
        t = { ...t, value: value as number };
      }

      return t;
    });

    this.setState({ thresholds: newThresholds });
  };

  onChangeThresholdColor = (threshold: Threshold, color: string) => {
    const { thresholds } = this.state;

    const newThresholds = thresholds.map(t => {
      if (t === threshold) {
        t = { ...t, color: color };
      }

      return t;
    });

    this.setState(
      {
        thresholds: newThresholds,
      },
      () => this.onChange()
    );
  };

  onBlur = () => {
    this.setState(prevState => {
      const sortThresholds = this.sortThresholds([...prevState.thresholds]);
      let index = 0;
      sortThresholds.forEach(t => {
        t.index = index++;
      });

      return { thresholds: sortThresholds };
    });

    this.onChange();
  };

  onChange = () => {
    this.props.onChange(this.state.thresholds);
  };

  sortThresholds = (thresholds: Threshold[]) => {
    return thresholds.sort((t1, t2) => {
      return t1.value - t2.value;
    });
  };

  renderInput = (threshold: Threshold) => {
    return (
      <div className="thresholds-row-input-inner">
        <span className="thresholds-row-input-inner-arrow" />
        <div className="thresholds-row-input-inner-color">
          {threshold.color && (
            <div className="thresholds-row-input-inner-color-colorpicker">
              <ColorPicker
                color={threshold.color}
                onChange={color => this.onChangeThresholdColor(threshold, color)}
                enableNamedColors={true}
              />
            </div>
          )}
        </div>
        {threshold.index === 0 && (
          <div className="thresholds-row-input-inner-value">
            <Input type="text" value="Base" readOnly />
          </div>
        )}
        {threshold.index > 0 && (
          <>
            <div className="thresholds-row-input-inner-value">
              <Input
                type="number"
                step="0.0001"
                onChange={(event: ChangeEvent<HTMLInputElement>) => this.onChangeThresholdValue(event, threshold)}
                value={threshold.value}
                onBlur={this.onBlur}
                readOnly={threshold.index === 0}
              />
            </div>
            <div className="thresholds-row-input-inner-remove" onClick={() => this.onRemoveThreshold(threshold)}>
              <i className="fa fa-times" />
            </div>
          </>
        )}
      </div>
    );
  };

  render() {
    const { thresholds } = this.state;
    return (
      <ThemeContext.Consumer>
        {theme => {
          return (
            <PanelOptionsGroup title="Thresholds">
              <div className="thresholds">
                {thresholds
                  .slice(0)
                  .reverse()
                  .map((threshold, index) => {
                    return (
                      <div className="thresholds-row" key={`${threshold.index}-${index}`}>
                        <div
                          className="thresholds-row-add-button"
                          onClick={() => this.onAddThreshold(threshold.index + 1)}
                        >
                          <i className="fa fa-plus" />
                        </div>
                        <div
                          className="thresholds-row-color-indicator"
                          style={{ backgroundColor: getColorFromHexRgbOrName(threshold.color, theme.type) }}
                        />
                        <div className="thresholds-row-input">{this.renderInput(threshold)}</div>
                      </div>
                    );
                  })}
              </div>
            </PanelOptionsGroup>
          );
        }}
      </ThemeContext.Consumer>
    );
  }
}

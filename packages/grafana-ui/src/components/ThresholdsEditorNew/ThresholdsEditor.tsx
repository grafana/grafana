import React, { PureComponent, ChangeEvent } from 'react';
import { css } from 'emotion';
import {
  Threshold,
  sortThresholds,
  ThresholdsConfig,
  ThresholdsMode,
  SelectableValue,
  GrafanaTheme,
} from '@grafana/data';
import { colors } from '../../utils';
import { ThemeContext } from '../../themes/ThemeContext';
import { Input } from '../Forms/Input/Input';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import { stylesFactory } from '../../themes';
import { Icon } from '../Icon/Icon';
import { RadioButtonGroup } from '../Forms/RadioButtonGroup/RadioButtonGroup';
import { Field } from '../Forms/Field';

const modes: Array<SelectableValue<ThresholdsMode>> = [
  { value: ThresholdsMode.Absolute, label: 'Absolute', description: 'Pick thresholds based on the absolute values' },
  {
    value: ThresholdsMode.Percentage,
    label: 'Percentage',
    description: 'Pick threshold based on the percent between min/max',
  },
];

export interface Props {
  thresholds: ThresholdsConfig;
  onChange: (thresholds: ThresholdsConfig) => void;
}

interface State {
  steps: ThresholdWithKey[];
}

export class ThresholdsEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const steps = toThresholdsWithKey(props.thresholds!.steps);
    steps[0].value = -Infinity;

    this.state = { steps };
  }

  onAddThresholdAfter = (threshold: ThresholdWithKey) => {
    const { steps } = this.state;

    const maxValue = 100;
    const minValue = 0;

    let prev: ThresholdWithKey | undefined = undefined;
    let next: ThresholdWithKey | undefined = undefined;
    for (const t of steps) {
      if (prev && prev.key === threshold.key) {
        next = t;
        break;
      }
      prev = t;
    }

    const prevValue = prev && isFinite(prev.value) ? prev.value : minValue;
    const nextValue = next && isFinite(next.value) ? next.value : maxValue;

    const color = colors.filter(c => !steps.some(t => t.color === c))[1];
    const add = {
      value: prevValue + (nextValue - prevValue) / 2.0,
      color: color,
      key: counter++,
    };
    const newThresholds = [...steps, add];
    sortThresholds(newThresholds);

    this.setState(
      {
        steps: newThresholds,
      },
      () => this.onChange()
    );
  };

  onRemoveThreshold = (threshold: ThresholdWithKey) => {
    const { steps } = this.state;
    if (!steps.length) {
      return;
    }
    // Don't remove index 0
    if (threshold.key === steps[0].key) {
      return;
    }
    this.setState(
      {
        steps: steps.filter(t => t.key !== threshold.key),
      },
      () => this.onChange()
    );
  };

  onChangeThresholdValue = (event: ChangeEvent<HTMLInputElement>, threshold: ThresholdWithKey) => {
    const cleanValue = event.target.value.replace(/,/g, '.');
    const parsedValue = parseFloat(cleanValue);
    const value = isNaN(parsedValue) ? '' : parsedValue;

    const steps = this.state.steps.map(t => {
      if (t.key === threshold.key) {
        t = { ...t, value: value as number };
      }
      return t;
    });
    if (steps.length) {
      steps[0].value = -Infinity;
    }
    this.setState({ steps });
  };

  onChangeThresholdColor = (threshold: ThresholdWithKey, color: string) => {
    const { steps } = this.state;

    const newThresholds = steps.map(t => {
      if (t.key === threshold.key) {
        t = { ...t, color: color };
      }

      return t;
    });

    this.setState(
      {
        steps: newThresholds,
      },
      () => this.onChange()
    );
  };

  onBlur = () => {
    const steps = [...this.state.steps];
    sortThresholds(steps);
    this.setState(
      {
        steps,
      },
      () => this.onChange()
    );
  };

  onChange = () => {
    this.props.onChange(thresholdsWithoutKey(this.props.thresholds, this.state.steps));
  };

  onModeChanged = (value: ThresholdsMode) => {
    this.props.onChange({
      ...this.props.thresholds,
      mode: value,
    });
  };

  renderInput(threshold: ThresholdWithKey, styles: ThresholdStyles) {
    const isPercent = this.props.thresholds.mode === ThresholdsMode.Percentage;

    if (!isFinite(threshold.value)) {
      return (
        <Input
          type="text"
          value={'Base'}
          disabled
          prefix={
            threshold.color && (
              <div className="thresholds-row-input-inner-color-colorpicker">
                <ColorPicker
                  color={threshold.color}
                  onChange={color => this.onChangeThresholdColor(threshold, color)}
                  enableNamedColors={true}
                />
              </div>
            )
          }
        />
      );
    }

    return (
      <div className="thresholds-row-input-inner-value">
        <Input
          type="number"
          step="0.0001"
          onChange={(event: ChangeEvent<HTMLInputElement>) => this.onChangeThresholdValue(event, threshold)}
          value={threshold.value}
          onBlur={this.onBlur}
          prefix={
            threshold.color && (
              <div className="thresholds-row-input-inner-color-colorpicker">
                <ColorPicker
                  color={threshold.color}
                  onChange={color => this.onChangeThresholdColor(threshold, color)}
                  enableNamedColors={true}
                />
              </div>
            )
          }
          suffix={<Icon name="trash" onClick={() => this.onRemoveThreshold(threshold)} />}
        />
      </div>
    );

    /* {isPercent && ( */
    /*               <div className={css(`margin-left:-20px; margin-top:5px;`)}> */
    /*                 <i className="fa fa-percent" /> */
    /*               </div> */
    /*             )} */
  }

  render() {
    const { thresholds } = this.props;
    const { steps } = this.state;

    return (
      <ThemeContext.Consumer>
        {theme => {
          const styles = getStyles(theme);
          return (
            <>
              <div className={styles.thresholds}>
                {steps
                  .slice(0)
                  .reverse()
                  .map(threshold => {
                    return (
                      <div className={styles.item} key={`${threshold.key}`}>
                        {this.renderInput(threshold, styles)}
                      </div>
                    );
                  })}
              </div>

              <Field label="Threshold mode">
                <RadioButtonGroup size="sm" options={modes} onChange={this.onModeChanged} value={thresholds.mode} />
              </Field>
            </>
          );
        }}
      </ThemeContext.Consumer>
    );
  }
}

interface ThresholdWithKey extends Threshold {
  key: number;
}

let counter = 100;

function toThresholdsWithKey(steps?: Threshold[]): ThresholdWithKey[] {
  if (!steps || steps.length === 0) {
    steps = [{ value: -Infinity, color: 'green' }];
  }

  return steps.map(t => {
    return {
      color: t.color,
      value: t.value === null ? -Infinity : t.value,
      key: counter++,
    };
  });
}

export function thresholdsWithoutKey(thresholds: ThresholdsConfig, steps: ThresholdWithKey[]): ThresholdsConfig {
  const mode = thresholds.mode ?? ThresholdsMode.Absolute;
  return {
    mode,
    steps: steps.map(t => {
      const { key, ...rest } = t;
      return rest; // everything except key
    }),
  };
}

interface ThresholdStyles {
  thresholds: string;
  item: string;
}

const getStyles = stylesFactory(
  (theme: GrafanaTheme): ThresholdStyles => {
    return {
      thresholds: css`
        display: flex;
        flex-direction: column;
      `,
      item: css`
        margin-bottom: ${theme.spacing.sm};
      `,
    };
  }
);

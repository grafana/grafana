import { css } from '@emotion/css';
import { isNumber } from 'lodash';
import React, { PureComponent, ChangeEvent } from 'react';

import {
  Threshold,
  sortThresholds,
  ThresholdsConfig,
  ThresholdsMode,
  SelectableValue,
  GrafanaTheme2,
} from '@grafana/data';
import {
  Input,
  colors,
  ColorPicker,
  ThemeContext,
  Button,
  Label,
  RadioButtonGroup,
  stylesFactory,
  IconButton,
} from '@grafana/ui';

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
  private latestThresholdInputRef: React.RefObject<HTMLInputElement>;

  constructor(props: Props) {
    super(props);

    const steps = toThresholdsWithKey(props.thresholds!.steps);
    steps[0].value = -Infinity;

    this.state = { steps };
    this.latestThresholdInputRef = React.createRef();
  }

  onAddThreshold = () => {
    const { steps } = this.state;

    let nextValue = 0;

    if (steps.length > 1) {
      nextValue = steps[steps.length - 1].value + 10;
    }

    let color = colors.filter((c) => !steps.some((t) => t.color === c))[1];
    if (!color) {
      // Default color when all colors are used
      color = '#CCCCCC';
    }

    const add = {
      value: nextValue,
      color: color,
      key: counter++,
    };

    const newThresholds = [...steps, add];
    sortThresholds(newThresholds);

    this.setState({ steps: newThresholds }, () => {
      if (this.latestThresholdInputRef.current) {
        this.latestThresholdInputRef.current.focus();
      }
      this.onChange();
    });
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

    this.setState({ steps: steps.filter((t) => t.key !== threshold.key) }, this.onChange);
  };

  onChangeThresholdValue = (event: ChangeEvent<HTMLInputElement>, threshold: ThresholdWithKey) => {
    const cleanValue = event.target.value.replace(/,/g, '.');
    const parsedValue = parseFloat(cleanValue);
    const value = isNaN(parsedValue) ? '' : parsedValue;

    const steps = this.state.steps.map((t) => {
      if (t.key === threshold.key) {
        t = { ...t, value: value as number };
      }
      return t;
    });

    if (steps.length) {
      steps[0].value = -Infinity;
    }

    sortThresholds(steps);
    this.setState({ steps });
  };

  onChangeThresholdColor = (threshold: ThresholdWithKey, color: string) => {
    const { steps } = this.state;

    const newThresholds = steps.map((t) => {
      if (t.key === threshold.key) {
        t = { ...t, color: color };
      }

      return t;
    });

    this.setState({ steps: newThresholds }, this.onChange);
  };

  onBlur = () => {
    const steps = [...this.state.steps];
    sortThresholds(steps);
    this.setState({ steps }, this.onChange);
  };

  onChange = () => {
    this.props.onChange(thresholdsWithoutKey(this.props.thresholds, this.state.steps));
  };

  onModeChanged = (value?: ThresholdsMode) => {
    this.props.onChange({
      ...this.props.thresholds,
      mode: value!,
    });
  };

  renderInput(threshold: ThresholdWithKey, styles: ThresholdStyles, idx: number) {
    const isPercent = this.props.thresholds.mode === ThresholdsMode.Percentage;

    const ariaLabel = `Threshold ${idx + 1}`;
    if (!isFinite(threshold.value)) {
      return (
        <Input
          type="text"
          value={'Base'}
          aria-label={ariaLabel}
          disabled
          prefix={
            <div className={styles.colorPicker}>
              <ColorPicker
                color={threshold.color}
                onChange={(color) => this.onChangeThresholdColor(threshold, color)}
                enableNamedColors={true}
              />
            </div>
          }
        />
      );
    }

    return (
      <Input
        type="number"
        step="0.0001"
        key={isPercent.toString()}
        onChange={(event: ChangeEvent<HTMLInputElement>) => this.onChangeThresholdValue(event, threshold)}
        value={threshold.value}
        aria-label={ariaLabel}
        ref={idx === 0 ? this.latestThresholdInputRef : null}
        onBlur={this.onBlur}
        prefix={
          <div className={styles.inputPrefix}>
            <div className={styles.colorPicker}>
              <ColorPicker
                color={threshold.color}
                onChange={(color) => this.onChangeThresholdColor(threshold, color)}
                enableNamedColors={true}
              />
            </div>
            {isPercent && <div className={styles.percentIcon}>%</div>}
          </div>
        }
        suffix={
          <IconButton
            aria-label={`Remove ${ariaLabel}`}
            className={styles.trashIcon}
            name="trash-alt"
            onClick={() => this.onRemoveThreshold(threshold)}
          />
        }
      />
    );
  }

  render() {
    const { thresholds } = this.props;
    const { steps } = this.state;

    return (
      <ThemeContext.Consumer>
        {(theme) => {
          const styles = getStyles(theme);
          return (
            <div className={styles.wrapper}>
              <Button
                size="sm"
                icon="plus"
                onClick={() => this.onAddThreshold()}
                variant="secondary"
                className={styles.addButton}
                fullWidth
              >
                Add threshold
              </Button>
              <div className={styles.thresholds}>
                {steps
                  .slice(0)
                  .reverse()
                  .map((threshold, idx) => (
                    <div className={styles.item} key={`${threshold.key}`}>
                      {this.renderInput(threshold, styles, idx)}
                    </div>
                  ))}
              </div>

              <div>
                <Label description="Percentage means thresholds relative to min & max">Thresholds mode</Label>
                <RadioButtonGroup options={modes} onChange={this.onModeChanged} value={thresholds.mode} />
              </div>
            </div>
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

  return steps
    .filter((t, i) => isNumber(t.value) || i === 0)
    .map((t) => {
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
    steps: steps.map((t) => {
      const { key, ...rest } = t;
      return rest; // everything except key
    }),
  };
}

interface ThresholdStyles {
  wrapper: string;
  thresholds: string;
  item: string;
  colorPicker: string;
  addButton: string;
  percentIcon: string;
  inputPrefix: string;
  trashIcon: string;
}

const getStyles = stylesFactory((theme: GrafanaTheme2): ThresholdStyles => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
    `,
    thresholds: css`
      display: flex;
      flex-direction: column;
      margin-bottom: ${theme.spacing(2)};
    `,
    item: css`
      margin-bottom: ${theme.spacing(1)};

      &:last-child {
        margin-bottom: 0;
      }
    `,
    colorPicker: css`
      padding: 0 ${theme.spacing(1)};
    `,
    addButton: css`
      margin-bottom: ${theme.spacing(1)};
    `,
    percentIcon: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
    `,
    inputPrefix: css`
      display: flex;
      align-items: center;
    `,
    trashIcon: css`
      color: ${theme.colors.text.secondary};
      cursor: pointer;
      margin-right: 0;

      &:hover {
        color: ${theme.colors.text};
      }
    `,
  };
});

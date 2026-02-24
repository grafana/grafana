import { css } from '@emotion/css';
import { isNumber } from 'lodash';
import { ChangeEvent, memo, useEffect, useRef, useState } from 'react';

import {
  GrafanaTheme2,
  SelectableValue,
  sortThresholds,
  Threshold,
  ThresholdsConfig,
  ThresholdsMode,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, ColorPicker, colors, IconButton, Input, Label, RadioButtonGroup, useStyles2 } from '@grafana/ui';

export interface Props {
  thresholds: ThresholdsConfig;
  onChange: (thresholds: ThresholdsConfig) => void;
}

export const ThresholdsEditor = memo(function ThresholdsEditor({ thresholds, onChange }: Props) {
  const [steps, setSteps] = useState<ThresholdWithKey[]>(() => {
    const steps = toThresholdsWithKey(thresholds.steps);
    steps[0].value = -Infinity;
    return steps;
  });
  const latestThresholdInputRef = useRef<HTMLInputElement>(null);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    latestThresholdInputRef.current?.focus();
  }, [steps.length]);

  function fireOnChange(newSteps: ThresholdWithKey[]) {
    onChange(thresholdsWithoutKey(thresholds, newSteps));
  }

  function onAddThreshold() {
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

    setSteps(newThresholds);
    fireOnChange(newThresholds);
  }

  function onRemoveThreshold(threshold: ThresholdWithKey) {
    if (!steps.length) {
      return;
    }

    // Don't remove index 0
    if (threshold.key === steps[0].key) {
      return;
    }

    const newSteps = steps.filter((t) => t.key !== threshold.key);
    setSteps(newSteps);
    fireOnChange(newSteps);
  }

  function onChangeThresholdValue(event: ChangeEvent<HTMLInputElement>, threshold: ThresholdWithKey) {
    const cleanValue = event.target.value.replace(/,/g, '.');
    const parsedValue = parseFloat(cleanValue);
    const value = isNaN(parsedValue) ? '' : parsedValue;

    const newSteps = steps.map((t) => {
      if (t.key === threshold.key) {
        t = { ...t, value: value as number };
      }
      return t;
    });

    if (newSteps.length) {
      newSteps[0].value = -Infinity;
    }

    sortThresholds(newSteps);
    setSteps(newSteps);
  }

  function onChangeThresholdColor(threshold: ThresholdWithKey, color: string) {
    const newThresholds = steps.map((t) => {
      if (t.key === threshold.key) {
        t = { ...t, color: color };
      }

      return t;
    });

    setSteps(newThresholds);
    fireOnChange(newThresholds);
  }

  function onBlur() {
    const newSteps = [...steps];
    sortThresholds(newSteps);
    setSteps(newSteps);
    fireOnChange(newSteps);
  }

  function onModeChanged(value?: ThresholdsMode) {
    onChange({
      ...thresholds,
      mode: value!,
    });
  }

  function renderInput(threshold: ThresholdWithKey, idx: number) {
    const isPercent = thresholds.mode === ThresholdsMode.Percentage;
    const thresholdNumber = idx + 1;

    const ariaLabel = t('dimensions.thresholds-editor.aria-label-threshold', 'Threshold {{thresholdNumber}}', {
      thresholdNumber,
    });
    if (!isFinite(threshold.value)) {
      return (
        <Input
          type="text"
          value={t('dimensions.thresholds-editor.value-base', 'Base')}
          aria-label={ariaLabel}
          disabled
          prefix={
            <div className={styles.colorPicker}>
              <ColorPicker
                color={threshold.color}
                onChange={(color) => onChangeThresholdColor(threshold, color)}
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
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChangeThresholdValue(event, threshold)}
        value={threshold.value}
        aria-label={ariaLabel}
        ref={idx === 0 ? latestThresholdInputRef : null}
        onBlur={onBlur}
        prefix={
          <div className={styles.inputPrefix}>
            <div className={styles.colorPicker}>
              <ColorPicker
                color={threshold.color}
                onChange={(color) => onChangeThresholdColor(threshold, color)}
                enableNamedColors={true}
              />
            </div>
            {isPercent && <div className={styles.percentIcon}>%</div>}
          </div>
        }
        suffix={
          <IconButton
            className={styles.trashIcon}
            name="trash-alt"
            onClick={() => onRemoveThreshold(threshold)}
            tooltip={t('dimensions.threshold-editor.tooltip-remove-threshold', 'Remove threshold {{thresholdNumber}}', {
              thresholdNumber,
            })}
          />
        }
      />
    );
  }

  const modes: Array<SelectableValue<ThresholdsMode>> = [
    {
      value: ThresholdsMode.Absolute,
      label: t('dimensions.thresholds-editor.modes.label.absolute', 'Absolute'),
      description: t(
        'dimensions.thresholds-editor.modes.description.thresholds-based-absolute-values',
        'Pick thresholds based on the absolute values'
      ),
    },
    {
      value: ThresholdsMode.Percentage,
      label: t('dimensions.thresholds-editor.modes.label.percentage', 'Percentage'),
      description: t(
        'dimensions.thresholds-editor.modes.description.threshold-based-percent-between-minmax',
        'Pick threshold based on the percent between min/max'
      ),
    },
  ];

  return (
    <div className={styles.wrapper}>
      <Button size="sm" icon="plus" onClick={onAddThreshold} variant="secondary" className={styles.addButton} fullWidth>
        <Trans i18nKey="dimensions.thresholds-editor.add-threshold">Add threshold</Trans>
      </Button>
      <div className={styles.thresholds}>
        {steps
          .slice(0)
          .reverse()
          .map((threshold, idx) => (
            <div className={styles.item} key={`${threshold.key}`}>
              {renderInput(threshold, idx)}
            </div>
          ))}
      </div>

      <div>
        <Label
          description={t(
            'dimensions.thresholds-editor.description-percentage-means-thresholds-relative',
            'Percentage means thresholds relative to min & max'
          )}
        >
          <Trans i18nKey="dimensions.thresholds-editor.thresholds-mode">Thresholds mode</Trans>
        </Label>
        <RadioButtonGroup options={modes} onChange={onModeChanged} value={thresholds.mode} />
      </div>
    </div>
  );
});

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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    thresholds: css({
      display: 'flex',
      flexDirection: 'column',
      marginBottom: theme.spacing(2),
    }),
    item: css({
      marginBottom: theme.spacing(1),

      '&:last-child': {
        marginBottom: 0,
      },
    }),
    colorPicker: css({
      padding: theme.spacing(0, 1),
    }),
    addButton: css({
      marginBottom: theme.spacing(1),
    }),
    percentIcon: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
    inputPrefix: css({
      display: 'flex',
      alignItems: 'center',
    }),
    trashIcon: css({
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      marginRight: 0,

      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
};

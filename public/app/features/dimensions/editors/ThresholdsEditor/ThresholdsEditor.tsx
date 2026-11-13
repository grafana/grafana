import { css } from '@emotion/css';
import { isNumber, omit } from 'lodash';
import { type ChangeEvent, memo, useContext, useEffect, useRef, useState } from 'react';

import {
  type GrafanaTheme2,
  type SelectableValue,
  sortThresholds,
  type Threshold,
  type ThresholdsConfig,
  ThresholdsMode,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useFlagGrafanaThresholdsInterpolation } from '@grafana/runtime/internal';
import { Button, ColorPicker, colors, IconButton, Input, Label, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { FieldConfigExpressionsContext } from 'app/core/components/OptionsUI/fieldConfigExpressions';
import { SuggestionsInput } from 'app/core/components/SuggestionsInput/SuggestionsInput';
import { getVariableSuggestions } from 'app/core/components/SuggestionsInput/getVariableSuggestions';

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
  const isMounted = useRef(false);
  const userAddedThreshold = useRef(false);
  const styles = useStyles2(getStyles);
  const thresholdsInterpolation = useFlagGrafanaThresholdsInterpolation();
  const fieldConfigExpressions = useContext(FieldConfigExpressionsContext);
  const interpolationEnabled = thresholdsInterpolation || fieldConfigExpressions;

  // Text being typed into a step, which can read differently from the step's value (e.g. `5.`)
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  // sync local steps when thresholds change
  useEffect(() => {
    const nextSteps = thresholds.steps ?? [];
    const currentSteps = stepsRef.current;
    const changed =
      currentSteps.length !== nextSteps.length ||
      currentSteps.some(
        (s, i) =>
          s.color !== nextSteps[i].color ||
          s.value !== (nextSteps[i].value ?? -Infinity) ||
          s.valueExpr !== nextSteps[i].valueExpr
      );
    if (changed) {
      const newSteps = toThresholdsWithKey(thresholds.steps);
      newSteps[0].value = -Infinity;
      setSteps(newSteps);
    }
  }, [thresholds]);

  useEffect(() => {
    if (isMounted.current && userAddedThreshold.current) {
      latestThresholdInputRef.current?.focus();
      userAddedThreshold.current = false;
    }
    isMounted.current = true;
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

    userAddedThreshold.current = true;
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

  function withThresholdValue(currentSteps: ThresholdWithKey[], threshold: ThresholdWithKey, rawValue: string) {
    const newSteps = currentSteps.map((t) => {
      if (t.key !== threshold.key) {
        return t;
      }

      if (interpolationEnabled && rawValue.includes('$')) {
        // a variable expression: store it alongside the numeric value, which stays as the fallback
        return { ...t, valueExpr: rawValue };
      }

      const cleanValue = rawValue.replace(/,/g, '.');
      const parsedValue = parseFloat(cleanValue);
      const { valueExpr, ...numericStep } = t;
      return { ...numericStep, value: (isNaN(parsedValue) ? '' : parsedValue) as number };
    });

    if (newSteps.length) {
      newSteps[0].value = -Infinity;
    }

    sortThresholds(newSteps);
    return newSteps;
  }

  function onChangeThresholdValue(threshold: ThresholdWithKey, rawValue: string) {
    setSteps(withThresholdValue(steps, threshold, rawValue));
  }

  function onChangeThresholdText(threshold: ThresholdWithKey, rawValue: string) {
    setDrafts((current) => ({ ...current, [threshold.key]: rawValue }));
    onChangeThresholdValue(threshold, rawValue);
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

  function commitSteps(currentSteps: ThresholdWithKey[]) {
    // an input left empty holds '' as its value — settle it to 0
    const newSteps = currentSteps.map((t) => (isNumber(t.value) ? t : { ...t, value: 0 }));
    sortThresholds(newSteps);
    setSteps(newSteps);
    fireOnChange(newSteps);
    return newSteps;
  }

  function onBlur() {
    commitSteps(steps);
  }

  // SuggestionsInput commits on blur and when a variable is picked. It reads the latest steps from
  // the ref because a pick reports the edit and the commit in one handler.
  function onCommitThresholdValue(threshold: ThresholdWithKey, rawValue: string) {
    commitSteps(withThresholdValue(stepsRef.current, threshold, rawValue));
    setDrafts((current) => omit(current, threshold.key));
  }

  function onModeChanged(value?: ThresholdsMode) {
    onChange({
      ...thresholds,
      mode: value!,
    });
  }

  const variableSuggestions = interpolationEnabled ? getVariableSuggestions() : [];

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

    const prefix = (
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
    );
    const suffix = (
      <IconButton
        className={styles.trashIcon}
        name="trash-alt"
        onClick={() => onRemoveThreshold(threshold)}
        tooltip={t('dimensions.threshold-editor.tooltip-remove-threshold', 'Remove threshold {{thresholdNumber}}', {
          thresholdNumber,
        })}
      />
    );

    if (interpolationEnabled) {
      // a text input that suggests dashboard variables, so expressions (e.g. $myVar) can be typed
      return (
        <SuggestionsInput
          key={isPercent.toString()}
          value={drafts[threshold.key] ?? threshold.valueExpr ?? threshold.value}
          suggestions={variableSuggestions}
          onInputChange={(rawValue) => onChangeThresholdText(threshold, rawValue)}
          onChange={(rawValue) => onCommitThresholdValue(threshold, rawValue)}
          aria-label={ariaLabel}
          inputRef={idx === 0 ? latestThresholdInputRef : null}
          prefix={prefix}
          suffix={suffix}
        />
      );
    }

    return (
      <Input
        type="number"
        step="0.0001"
        key={isPercent.toString()}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChangeThresholdValue(threshold, event.target.value)}
        value={threshold.value}
        aria-label={ariaLabel}
        ref={idx === 0 ? latestThresholdInputRef : null}
        onBlur={onBlur}
        prefix={prefix}
        suffix={suffix}
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
    .map((t, i) => {
      const step: ThresholdWithKey = {
        color: t.color,
        value: t.value === null ? -Infinity : t.value,
        key: counter++,
      };
      // the base step never carries an expression
      if (t.valueExpr && i > 0) {
        step.valueExpr = t.valueExpr;
      }
      return step;
    });
}

function thresholdsWithoutKey(thresholds: ThresholdsConfig, steps: ThresholdWithKey[]): ThresholdsConfig {
  const mode = thresholds.mode ?? ThresholdsMode.Absolute;
  return {
    mode,
    steps: steps.map((t) => {
      const { key, ...rest } = t;
      // never persist the '' an input cleared mid-edit holds — the backend requires a number
      return isNumber(rest.value) ? rest : { ...rest, value: 0 };
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

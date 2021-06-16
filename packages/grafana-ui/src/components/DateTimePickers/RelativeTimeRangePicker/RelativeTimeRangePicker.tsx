import React, { FormEvent, ReactElement, useCallback, useState } from 'react';
import { css, cx } from '@emotion/css';
import { RelativeTimeRange, GrafanaTheme2, TimeOption } from '@grafana/data';
import { useStyles2 } from '../../../themes';
import { Button } from '../../Button';
import { ClickOutsideWrapper } from '../../ClickOutsideWrapper/ClickOutsideWrapper';
import { TimeRangeList } from '../TimeRangePicker/TimeRangeList';
import { quickOptions } from '../rangeOptions';
import CustomScrollbar from '../../CustomScrollbar/CustomScrollbar';
import { TimePickerTitle } from '../TimeRangePicker/TimePickerTitle';
import {
  isRangeValid,
  isRelativeFormat,
  mapOptionToRelativeTimeRange,
  mapRelativeTimeRangeToOption,
  RangeValidation,
} from './utils';
import { Field } from '../../Forms/Field';
import { getInputStyles, Input } from '../../Input/Input';
import { Icon } from '../../Icon/Icon';

/**
 * @internal
 */
export interface RelativeTimeRangePickerProps {
  timeRange: RelativeTimeRange;
  onChange: (timeRange: RelativeTimeRange) => void;
}

type InputState = {
  value: string;
  validation: RangeValidation;
};

const validOptions = quickOptions.filter((o) => isRelativeFormat(o.from));

/**
 * @internal
 */
export function RelativeTimeRangePicker(props: RelativeTimeRangePickerProps): ReactElement | null {
  const { timeRange, onChange } = props;
  const [isOpen, setIsOpen] = useState(false);
  const onClose = useCallback(() => setIsOpen(false), []);
  const timeOption = mapRelativeTimeRangeToOption(timeRange);
  const [from, setFrom] = useState<InputState>({ value: timeOption.from, validation: isRangeValid(timeOption.from) });
  const [to, setTo] = useState<InputState>({ value: timeOption.to, validation: isRangeValid(timeOption.to) });

  const styles = useStyles2(getStyles(from.validation.errorMessage, to.validation.errorMessage));

  const onChangeTimeOption = (option: TimeOption) => {
    const relativeTimeRange = mapOptionToRelativeTimeRange(option);
    if (!relativeTimeRange) {
      return;
    }
    onClose();
    setFrom({ ...from, value: option.from });
    setTo({ ...to, value: option.to });
    onChange(relativeTimeRange);
  };

  const onOpen = useCallback(
    (event: FormEvent<HTMLDivElement>) => {
      event.stopPropagation();
      event.preventDefault();
      setIsOpen(!isOpen);
    },
    [isOpen]
  );

  const onApply = (event: FormEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (!to.validation.isValid || !from.validation.isValid) {
      return;
    }

    const timeRange = mapOptionToRelativeTimeRange({
      from: from.value,
      to: to.value,
      display: '',
    });

    if (!timeRange) {
      return;
    }

    onChange(timeRange);
    setIsOpen(false);
  };

  return (
    <div className={styles.container}>
      <div tabIndex={0} className={styles.pickerInput} onClick={onOpen}>
        <span className={styles.clockIcon}>
          <Icon name="clock-nine" />
        </span>
        <span>
          {timeOption.from} to {timeOption.to}
        </span>
        <span className={styles.caretIcon}>
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} size="lg" />
        </span>
      </div>
      {isOpen && (
        <ClickOutsideWrapper includeButtonPress={false} onClick={onClose}>
          <div className={styles.content}>
            <div className={styles.body}>
              <CustomScrollbar className={styles.leftSide} hideHorizontalTrack>
                <TimeRangeList
                  title="Example time ranges"
                  options={validOptions}
                  onChange={onChangeTimeOption}
                  value={timeOption}
                />
              </CustomScrollbar>
              <div className={styles.rightSide}>
                <div className={styles.title}>
                  <TimePickerTitle>Specify time range</TimePickerTitle>
                  <div className={styles.description}>
                    Specify a relative time range, for more information see{' '}
                    <a href="https://grafana.com/docs/grafana/latest/dashboards/time-range-controls/">
                      docs <Icon name="external-link-alt" />
                    </a>
                    .
                  </div>
                </div>
                <Field label="From" invalid={!from.validation.isValid} error={from.validation.errorMessage}>
                  <Input
                    onClick={(event) => event.stopPropagation()}
                    onBlur={() => setFrom({ ...from, validation: isRangeValid(from.value) })}
                    onChange={(event) => setFrom({ ...from, value: event.currentTarget.value })}
                    value={from.value}
                  />
                </Field>
                <Field label="To" invalid={!to.validation.isValid} error={to.validation.errorMessage}>
                  <Input
                    onClick={(event) => event.stopPropagation()}
                    onBlur={() => setTo({ ...to, validation: isRangeValid(to.value) })}
                    onChange={(event) => setTo({ ...to, value: event.currentTarget.value })}
                    value={to.value}
                  />
                </Field>
                <Button aria-label="TimePicker submit button" onClick={onApply}>
                  Apply time range
                </Button>
              </div>
            </div>
          </div>
        </ClickOutsideWrapper>
      )}
    </div>
  );
}

const getStyles = (fromError?: string, toError?: string) => (theme: GrafanaTheme2) => {
  const inputStyles = getInputStyles({ theme, invalid: false });
  const bodyMinimumHeight = 250;
  const bodyHeight = bodyMinimumHeight + calculateErrorHeight(theme, fromError) + calculateErrorHeight(theme, toError);

  return {
    container: css`
      display: flex;
      position: relative;
    `,
    pickerInput: cx(
      inputStyles.input,
      inputStyles.wrapper,
      css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        padding-right: 0;
        padding-left: 0;
        line-height: ${theme.v1.spacing.formInputHeight - 2}px;
      `
    ),
    caretIcon: cx(
      inputStyles.suffix,
      css`
        position: relative;
        margin-left: ${theme.v1.spacing.xs};
      `
    ),
    clockIcon: cx(
      inputStyles.prefix,
      css`
        position: relative;
        margin-right: ${theme.v1.spacing.xs};
      `
    ),
    content: css`
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      width: 500px;
      top: 100%;
      border-radius: 2px;
      border: 1px solid ${theme.colors.border.weak};
      left: 0;
      white-space: normal;
    `,
    body: css`
      display: flex;
      height: ${bodyHeight}px;
    `,
    description: css`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.size.sm};
    `,
    leftSide: css`
      width: 50% !important;
      border-right: 1px solid ${theme.colors.border.medium};
    `,
    rightSide: css`
      width: 50%;
      padding: ${theme.spacing(1)};
    `,
    title: css`
      margin-bottom: ${theme.spacing(1)};
    `,
  };
};

function calculateErrorHeight(theme: GrafanaTheme2, errorMessage?: string): number {
  if (!errorMessage) {
    return 0;
  }

  if (errorMessage.length > 34) {
    return theme.spacing.gridSize * 6.5;
  }

  return theme.spacing.gridSize * 4;
}

import React, { FormEvent, ReactElement, useCallback, useState } from 'react';
import { css } from '@emotion/css';
import { RelativeTimeRange, GrafanaTheme2, isDateTime, TimeOption, rangeUtil } from '@grafana/data';
import { Tooltip } from '../../Tooltip/Tooltip';
import { useStyles2 } from '../../../themes';
import { Button, ButtonGroup, ToolbarButton } from '../../Button';
import { ClickOutsideWrapper } from '../../ClickOutsideWrapper/ClickOutsideWrapper';
import { TimeRangeList } from '../TimeRangePicker/TimeRangeList';
import { quickOptions } from '../rangeOptions';
import CustomScrollbar from '../../CustomScrollbar/CustomScrollbar';
import { TimePickerTitle } from '../TimeRangePicker/TimePickerTitle';
import { mapOptionToRelativeTimeRange, mapRelativeTimeRangeToOption } from '../TimeRangePicker/mapper';
import { Field } from '../../Forms/Field';
import { Input } from '../../Input/Input';
import { InputState } from '../TimeRangePicker/TimeRangeForm';

export interface RelativeTimeRangePickerProps {
  timeRange: RelativeTimeRange;
  onChange: (timeRange: RelativeTimeRange) => void;
}

const errorMessage = 'Please enter a past date or "now"';

export function RelativeTimeRangePicker(props: RelativeTimeRangePickerProps): ReactElement | null {
  const { timeRange, onChange } = props;
  const styles = useStyles2(getStyles);

  const [isOpen, setIsOpen] = useState(false);
  const onClose = useCallback(() => setIsOpen(false), []);
  const timeOption = mapRelativeTimeRangeToOption(timeRange);
  const [from, setFrom] = useState<InputState>(setValue(timeOption.from));
  const [to, setTo] = useState<InputState>(setValue(timeOption.to));

  const onChangeTimeOption = (option: TimeOption) => {
    const relativeTimeRange = mapOptionToRelativeTimeRange(option);

    if (!relativeTimeRange) {
      return;
    }
    onChange(relativeTimeRange);
  };

  const onOpen = useCallback(
    (event: FormEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      setIsOpen(!isOpen);
    },
    [isOpen]
  );

  const onApply = (event: FormEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const timeRange = mapOptionToRelativeTimeRange({ from: from.value, to: to.value, display: '' });
    if (to.invalid || from.invalid || !timeRange) {
      return;
    }
    onChange(timeRange);
    setIsOpen(false);
  };

  return (
    <ButtonGroup className={styles.container}>
      <Tooltip content="Choose time range" placement="bottom">
        <ToolbarButton aria-label="TimePicker Open Button" onClick={onOpen} icon="clock-nine" isOpen={isOpen}>
          <span data-testid="picker-button-label" className={styles.container}>
            {rangeUtil.describeTimeRange({ from: timeOption.from, to: timeOption.to })}
          </span>
        </ToolbarButton>
      </Tooltip>
      {isOpen && (
        <ClickOutsideWrapper includeButtonPress={false} onClick={onClose}>
          <div className={styles.content}>
            <div className={styles.body}>
              <CustomScrollbar className={styles.leftSide} hideHorizontalTrack>
                <TimeRangeList
                  title="Example time ranges"
                  options={quickOptions}
                  onChange={onChangeTimeOption}
                  value={timeOption}
                />
              </CustomScrollbar>
              <div className={styles.rightSide}>
                <div className={styles.title}>
                  <TimePickerTitle>Specify time range</TimePickerTitle>
                </div>
                <Field label="From" invalid={from.invalid} error={errorMessage}>
                  <Input
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setFrom(setValue(event.currentTarget.value))}
                    value={from.value}
                  />
                </Field>
                <Field label="To" invalid={to.invalid} error={errorMessage}>
                  <Input
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setTo(setValue(event.currentTarget.value))}
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
    </ButtonGroup>
  );
}

const setValue = (value: string): InputState => {
  return {
    value,
    invalid: !isDateTime(value),
  };
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      position: relative;
      display: flex;
      vertical-align: middle;
    `,
    content: css`
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      width: 500px;
      top: 116%;
      border-radius: 2px;
      border: 1px solid ${theme.colors.border.weak};
      right: 0;
    `,
    body: css`
      display: flex;
      height: 217px;
    `,
    leftSide: css`
      width: 50% !important;
      overflow: hidden;
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

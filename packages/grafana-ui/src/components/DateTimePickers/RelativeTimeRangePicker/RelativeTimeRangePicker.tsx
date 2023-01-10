import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import React, { FormEvent, useCallback, useRef, useState } from 'react';
import { usePopper } from 'react-popper';

import { RelativeTimeRange, GrafanaTheme2, TimeOption } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { Trans, t } from '../../../utils/i18n';
import { Button } from '../../Button';
import CustomScrollbar from '../../CustomScrollbar/CustomScrollbar';
import { Field } from '../../Forms/Field';
import { Icon } from '../../Icon/Icon';
import { getInputStyles, Input } from '../../Input/Input';
import { Portal } from '../../Portal/Portal';
import { Tooltip } from '../../Tooltip/Tooltip';
import { TimePickerTitle } from '../TimeRangePicker/TimePickerTitle';
import { TimeRangeList } from '../TimeRangePicker/TimeRangeList';
import { quickOptions } from '../options';

import {
  isRangeValid,
  isRelativeFormat,
  mapOptionToRelativeTimeRange,
  mapRelativeTimeRangeToOption,
  RangeValidation,
} from './utils';

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
export function RelativeTimeRangePicker(props: RelativeTimeRangePickerProps) {
  const { timeRange, onChange } = props;
  const [isOpen, setIsOpen] = useState(false);
  const onClose = useCallback(() => setIsOpen(false), []);
  const timeOption = mapRelativeTimeRangeToOption(timeRange);
  const [from, setFrom] = useState<InputState>({ value: timeOption.from, validation: isRangeValid(timeOption.from) });
  const [to, setTo] = useState<InputState>({ value: timeOption.to, validation: isRangeValid(timeOption.to) });
  const ref = useRef<HTMLDivElement>(null);
  const { overlayProps, underlayProps } = useOverlay(
    { onClose: () => setIsOpen(false), isDismissable: true, isOpen },
    ref
  );
  const { dialogProps } = useDialog({}, ref);

  const [markerElement, setMarkerElement] = useState<HTMLDivElement | null>(null);
  const [selectorElement, setSelectorElement] = useState<HTMLDivElement | null>(null);
  const popper = usePopper(markerElement, selectorElement, {
    placement: 'auto-start',
  });

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
    (event: FormEvent<HTMLButtonElement>) => {
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
    <div className={styles.container} ref={setMarkerElement}>
      <button className={styles.pickerInput} type="button" onClick={onOpen}>
        <span className={styles.clockIcon}>
          <Icon name="clock-nine" />
        </span>
        <span>
          {timeOption.from} to {timeOption.to}
        </span>
        <span className={styles.caretIcon}>
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} size="lg" />
        </span>
      </button>
      {isOpen && (
        <Portal>
          <div role="presentation" className={styles.backdrop} {...underlayProps} />
          <FocusScope contain autoFocus restoreFocus>
            <div ref={ref} {...overlayProps} {...dialogProps}>
              <div
                className={styles.content}
                ref={setSelectorElement}
                style={popper.styles.popper}
                {...popper.attributes}
              >
                <div className={styles.body}>
                  <CustomScrollbar className={styles.leftSide} hideHorizontalTrack>
                    <TimeRangeList
                      title={t('time-picker.time-range.example-title', 'Example time ranges')}
                      options={validOptions}
                      onChange={onChangeTimeOption}
                      value={timeOption}
                    />
                  </CustomScrollbar>
                  <div className={styles.rightSide}>
                    <div className={styles.title}>
                      <TimePickerTitle>
                        <Tooltip content={<TooltipContent />} placement="bottom" theme="info">
                          <div>
                            <Trans i18nKey="time-picker.time-range.specify">
                              Specify time range <Icon name="info-circle" />
                            </Trans>
                          </div>
                        </Tooltip>
                      </TimePickerTitle>
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
            </div>
          </FocusScope>
        </Portal>
      )}
    </div>
  );
}

const TooltipContent = () => {
  const styles = useStyles2(toolTipStyles);
  return (
    <>
      <div className={styles.supported}>
        Supported formats: <code className={styles.tooltip}>now-[digit]s/m/h/d/w</code>
      </div>
      <div>Example: to select a time range from 10 minutes ago to now</div>
      <code className={styles.tooltip}>From: now-10m To: now</code>
      <div className={styles.link}>
        For more information see{' '}
        <a href="https://grafana.com/docs/grafana/latest/dashboards/time-range-controls/">
          docs <Icon name="external-link-alt" />
        </a>
        .
      </div>
    </>
  );
};

const toolTipStyles = (theme: GrafanaTheme2) => ({
  supported: css`
    margin-bottom: ${theme.spacing(1)};
  `,
  tooltip: css`
    margin: 0;
  `,
  link: css`
    margin-top: ${theme.spacing(1)};
  `,
});

const getStyles = (fromError?: string, toError?: string) => (theme: GrafanaTheme2) => {
  const inputStyles = getInputStyles({ theme, invalid: false });
  const bodyMinimumHeight = 250;
  const bodyHeight = bodyMinimumHeight + calculateErrorHeight(theme, fromError) + calculateErrorHeight(theme, toError);

  return {
    backdrop: css`
      position: fixed;
      z-index: ${theme.zIndex.modalBackdrop};
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
    `,
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
        line-height: ${theme.spacing.gridSize * theme.components.height.md - 2}px;
      `
    ),
    caretIcon: cx(
      inputStyles.suffix,
      css`
        position: relative;
        margin-left: ${theme.spacing(0.5)};
      `
    ),
    clockIcon: cx(
      inputStyles.prefix,
      css`
        position: relative;
        margin-right: ${theme.spacing(0.5)};
      `
    ),
    content: css`
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      position: absolute;
      z-index: ${theme.zIndex.modal};
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

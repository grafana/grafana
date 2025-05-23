import { css } from '@emotion/css';
import { formatDuration } from 'date-fns';
import { PureComponent } from 'react';

import { SelectableValue, parseDuration } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useTranslate } from '@grafana/i18n';

import { ButtonGroup } from '../Button';
import { ButtonSelect } from '../Dropdown/ButtonSelect';
import { ToolbarButtonVariant, ToolbarButton } from '../ToolbarButton';

// Default intervals used in the refresh picker component
export const defaultIntervals = ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'];

export interface Props {
  intervals?: string[];
  onRefresh?: () => void;
  onIntervalChanged: (interval: string) => void;
  value?: string;
  tooltip?: string;
  isLoading?: boolean;
  isLive?: boolean;
  text?: string;
  noIntervalPicker?: boolean;
  showAutoInterval?: boolean;
  width?: string;
  primary?: boolean;
  isOnCanvas?: boolean;
}

export class RefreshPicker extends PureComponent<Props> {
  static offOption = {
    label: 'Off',
    value: '',
    ariaLabel: 'Turn off auto refresh',
  };
  static liveOption = {
    label: 'Live',
    value: 'LIVE',
    ariaLabel: 'Turn on live streaming',
  };
  static autoOption = {
    label: 'Auto',
    value: 'auto',
    ariaLabel: 'Select refresh from the query range',
  };

  static isLive = (refreshInterval?: string): boolean => refreshInterval === RefreshPicker.liveOption.value;

  constructor(props: Props) {
    super(props);
  }

  onChangeSelect = (item: SelectableValue<string>) => {
    const { onIntervalChanged } = this.props;
    if (onIntervalChanged && item.value != null) {
      onIntervalChanged(item.value);
    }
  };

  getVariant(): ToolbarButtonVariant {
    if (this.props.isLive) {
      return 'primary';
    }

    if (this.props.primary) {
      return 'primary';
    }

    return this.props.isOnCanvas ? 'canvas' : 'default';
  }

  render() {
    const { onRefresh, intervals, tooltip, value, text, isLoading, noIntervalPicker, width, showAutoInterval } =
      this.props;

    const currentValue = value || '';
    const variant = this.getVariant();

    return (
      <ButtonGroup className="refresh-picker">
        <ToolbarButton
          aria-label={text}
          tooltip={tooltip}
          onClick={onRefresh}
          variant={variant}
          icon={isLoading ? 'spinner' : 'sync'}
          style={width ? { width } : undefined}
          data-testid={selectors.components.RefreshPicker.runButtonV2}
        >
          {text}
        </ToolbarButton>
        {!noIntervalPicker && (
          <RefreshButtonSelect
            currentValue={currentValue}
            intervals={intervals}
            showAutoInterval={showAutoInterval}
            onChange={this.onChangeSelect}
            variant={variant}
          />
        )}
      </ButtonGroup>
    );
  }
}

interface RefreshButtonSelectProps {
  currentValue: string;
  intervals?: string[];
  onChange: (item: SelectableValue<string>) => void;
  showAutoInterval?: boolean;
  variant: ToolbarButtonVariant;
}

function RefreshButtonSelect({
  currentValue,
  intervals,
  showAutoInterval,
  onChange,
  variant,
}: RefreshButtonSelectProps) {
  const { t } = useTranslate();
  const options = useTranslatedOptions(intervals, showAutoInterval);
  const option = options.find(({ value }) => value === currentValue);
  const translatedOffOption = useTranslateOption(RefreshPicker.offOption.value);
  let selectedValue = option || translatedOffOption;

  if (selectedValue.label === translatedOffOption.label) {
    selectedValue = { value: '' };
  }

  const durationAriaLabel = selectedValue.ariaLabel;
  const ariaLabelDurationSelectedMessage = t(
    'refresh-picker.aria-label.duration-selected',
    'Choose refresh time interval with current interval {{durationAriaLabel}} selected',
    { durationAriaLabel }
  );
  const ariaLabelChooseIntervalMessage = t(
    'refresh-picker.aria-label.choose-interval',
    'Auto refresh turned off. Choose refresh time interval'
  );
  const ariaLabel = selectedValue.value === '' ? ariaLabelChooseIntervalMessage : ariaLabelDurationSelectedMessage;

  const tooltipIntervalSelected = t('refresh-picker.tooltip.interval-selected', 'Set auto refresh interval');
  const tooltipAutoRefreshOff = t('refresh-picker.tooltip.turned-off', 'Auto refresh off');
  const tooltipAutoRefresh = selectedValue.value === '' ? tooltipAutoRefreshOff : tooltipIntervalSelected;

  return (
    <ButtonSelect
      className={css({
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
      })}
      value={selectedValue}
      options={options}
      onChange={onChange}
      variant={variant}
      data-testid={selectors.components.RefreshPicker.intervalButtonV2}
      aria-label={ariaLabel}
      tooltip={tooltipAutoRefresh}
    />
  );
}

function useTranslateOption(option: string): {
  label: string;
  value: string;
  ariaLabel?: string;
} {
  const { t } = useTranslate();
  switch (option) {
    case RefreshPicker.liveOption.value:
      return {
        label: t('refresh-picker.live-option.label', 'Live'),
        value: option,
        ariaLabel: t('refresh-picker.live-option.aria-label', 'Turn on live streaming'),
      };
    case RefreshPicker.offOption.value:
      return {
        label: t('refresh-picker.off-option.label', 'Off'),
        value: option,
        ariaLabel: t('refresh-picker.off-option.aria-label', 'Turn off auto refresh'),
      };
    case RefreshPicker.autoOption.value:
      return {
        label: t('refresh-picker.auto-option.label', RefreshPicker.autoOption.label),
        value: option,
        ariaLabel: t('refresh-picker.auto-option.aria-label', RefreshPicker.autoOption.ariaLabel),
      };
  }
  return {
    label: option,
    value: option,
  };
}

export function useTranslatedOptions(intervals: string[] = defaultIntervals, showAutoInterval = false) {
  const autoOption = useTranslateOption(RefreshPicker.autoOption.value);
  const offOption = useTranslateOption(RefreshPicker.offOption.value);

  const options: Array<SelectableValue<string>> = intervals.map((interval) => {
    const duration = parseDuration(interval);
    const ariaLabel = formatDuration(duration);

    return {
      label: interval,
      value: interval,
      ariaLabel: ariaLabel,
    };
  });

  if (showAutoInterval) {
    options.unshift(autoOption);
  }
  options.unshift(offOption);
  return options;
}

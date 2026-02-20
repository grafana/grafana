import { css } from '@emotion/css';
import { formatDuration } from 'date-fns';
import { memo } from 'react';

import { SelectableValue, parseDuration } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { ButtonGroup } from '../Button/ButtonGroup';
import { ButtonSelect } from '../Dropdown/ButtonSelect';
import { ToolbarButton, ToolbarButtonVariant } from '../ToolbarButton/ToolbarButton';

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

const offOption = {
  label: 'Off',
  value: '',
  ariaLabel: 'Off',
};
const liveOption = {
  label: 'Live',
  value: 'LIVE',
  ariaLabel: 'Live',
};
const autoOption = {
  label: 'Auto',
  value: 'auto',
  ariaLabel: 'Auto',
};

/**
 * This component is used on dashboards to refresh visualizations.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/pickers-refreshpicker--docs
 */
const RefreshPickerComponent = memo((props: Props) => {
  const {
    intervals,
    onRefresh,
    onIntervalChanged,
    value,
    tooltip,
    isLoading,
    isLive,
    text,
    noIntervalPicker,
    showAutoInterval,
    width,
    primary,
    isOnCanvas,
  } = props;
  const currentValue = value || '';
  const options = intervalsToOptions({ intervals, showAutoInterval });
  const option = options.find(({ value }) => value === currentValue);
  const translatedOffOption = translateOption(offOption.value);
  let selectedValue = option || translatedOffOption;
  const handleChangeSelect = (item: SelectableValue<string>) => {
    if (onIntervalChanged && item.value != null) {
      onIntervalChanged(item.value);
    }
  };

  const getVariant = (): ToolbarButtonVariant => {
    if (isLive) {
      return 'primary';
    }

    if (primary) {
      return 'primary';
    }

    return isOnCanvas ? 'canvas' : 'default';
  };
  const variant = getVariant();

  if (selectedValue.label === translatedOffOption.label) {
    selectedValue = { value: '' };
  }

  const durationAriaLabel = selectedValue.ariaLabel ?? selectedValue.label;
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
        <ButtonSelect
          className={css({
            borderTopLeftRadius: 'unset',
            borderBottomLeftRadius: 'unset',
          })}
          value={selectedValue}
          options={options}
          onChange={handleChangeSelect}
          variant={variant}
          data-testid={selectors.components.RefreshPicker.intervalButtonV2}
          aria-label={ariaLabel}
          tooltip={tooltipAutoRefresh}
        />
      )}
    </ButtonGroup>
  );
});

RefreshPickerComponent.displayName = 'RefreshPicker';

export const RefreshPicker = Object.assign(RefreshPickerComponent, {
  isLive: (refreshInterval?: string): boolean => refreshInterval === liveOption.value,
  liveOption,
  offOption,
  autoOption,
});

export const translateOption = (option: string): SelectableValue<string> => {
  switch (option) {
    case liveOption.value:
      return {
        label: t('refresh-picker.live-option.label', 'Live'),
        value: option,
      };
    case offOption.value:
      return {
        label: t('refresh-picker.off-option.label', 'Off'),
        value: option,
      };
    case autoOption.value:
      return {
        label: t('refresh-picker.auto-option.label', 'Auto'),
        value: option,
      };
  }
  return {
    label: option,
    value: option,
  };
};

export const intervalsToOptions = ({
  intervals = defaultIntervals,
  showAutoInterval = false,
}: { intervals?: string[]; showAutoInterval?: boolean } = {}): Array<SelectableValue<string>> => {
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
    options.unshift(translateOption(autoOption.value));
  }
  options.unshift(translateOption(offOption.value));
  return options;
};

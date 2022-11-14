import formatDuration from 'date-fns/formatDuration';
import React, { PureComponent } from 'react';

import { SelectableValue, parseDuration } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { t } from '../../utils/i18n';
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

    if (this.props.isLoading) {
      return 'destructive';
    }

    if (this.props.primary) {
      return 'primary';
    }

    return this.props.isOnCanvas ? 'canvas' : 'default';
  }

  render() {
    const { onRefresh, intervals, tooltip, value, text, isLoading, noIntervalPicker, width } = this.props;

    const currentValue = value || '';
    const variant = this.getVariant();
    const options = intervalsToOptions({ intervals });
    const option = options.find(({ value }) => value === currentValue);
    const translatedOffOption = translateOption(RefreshPicker.offOption.value);
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

    return (
      <ButtonGroup className="refresh-picker">
        <ToolbarButton
          aria-label={text}
          tooltip={tooltip}
          onClick={onRefresh}
          variant={variant}
          icon={isLoading ? 'fa fa-spinner' : 'sync'}
          style={width ? { width } : undefined}
          data-testid={selectors.components.RefreshPicker.runButtonV2}
        >
          {text}
        </ToolbarButton>
        {!noIntervalPicker && (
          <ButtonSelect
            value={selectedValue}
            options={options}
            onChange={this.onChangeSelect}
            variant={variant}
            title={t('refresh-picker.select-button.auto-refresh', 'Set auto refresh interval')}
            data-testid={selectors.components.RefreshPicker.intervalButtonV2}
            aria-label={ariaLabel}
          />
        )}
      </ButtonGroup>
    );
  }
}

export function translateOption(option: string) {
  if (option === RefreshPicker.liveOption.value) {
    return {
      label: t('refresh-picker.live-option.label', 'Live'),
      value: 'LIVE',
      ariaLabel: t('refresh-picker.live-option.aria-label', 'Turn on live streaming'),
    };
  }
  return {
    label: t('refresh-picker.off-option.label', 'Off'),
    value: '',
    ariaLabel: t('refresh-picker.off-option.aria-label', 'Turn off auto refresh'),
  };
}

export function intervalsToOptions({ intervals = defaultIntervals }: { intervals?: string[] } = {}): Array<
  SelectableValue<string>
> {
  const options: Array<SelectableValue<string>> = intervals.map((interval) => {
    const duration = parseDuration(getIntervalTranslated(interval));
    const ariaLabel = formatDuration(duration);

    return {
      label: getIntervalTranslated(interval),
      value: getIntervalTranslated(interval),
      ariaLabel: ariaLabel,
    };
  });

  options.unshift(translateOption(RefreshPicker.offOption.value));
  return options;
}

export function getIntervalTranslated(interval: string): string {
  let translate = () => '';
  switch (interval) {
    case '5s':
      translate = () => t('refresh-picker.default-intervals.5s', '5s');
      interval = translate();
      break;
    case '10s':
      translate = () => t('refresh-picker.default-intervals.10s', '10s');
      interval = translate();
      break;
    case '30s':
      translate = () => t('refresh-picker.default-intervals.30s', '30s');
      interval = translate();
      break;
    case '1m':
      translate = () => t('refresh-picker.default-intervals.1m', '1m');
      interval = translate();
      break;
    case '5m':
      translate = () => t('refresh-picker.default-intervals.5m', '5m');
      interval = translate();
      break;
    case '15m':
      translate = () => t('refresh-picker.default-intervals.15m', '15m');
      interval = translate();
      break;
    case '30m':
      translate = () => t('refresh-picker.default-intervals.30m', '30m');
      interval = translate();
      break;
    case '1h':
      translate = () => t('refresh-picker.default-intervals.1h', '1h');
      interval = translate();
      break;
    case '2h':
      translate = () => t('refresh-picker.default-intervals.2h', '2h');
      interval = translate();
      break;
    case '1d':
      translate = () => t('refresh-picker.default-intervals.1d', '1d');
      interval = translate();
      break;
    default:
      interval = interval;
      break;
  }
  return interval;
}

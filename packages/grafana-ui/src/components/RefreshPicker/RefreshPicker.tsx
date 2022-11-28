import formatDuration from 'date-fns/formatDuration';
import React, { PureComponent } from 'react';

import { SelectableValue, parseDuration } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { ButtonGroup } from '../Button';
import { ButtonSelect } from '../Dropdown/ButtonSelect';
import { ToolbarButtonVariant, ToolbarButton } from '../ToolbarButton';

// Default intervals used in the refresh picker component
export const defaultIntervals = ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'];

export interface Props {
  intervals?: string[];
  onRefresh?: () => any;
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
  // These props are used to translate the component
  offOptionLabelMsg?: string;
  offOptionAriaLabelMsg?: string;
  offDescriptionAriaLabelMsg?: string;
  onDescriptionAriaLabelMsg?: (durationAriaLabel: string | undefined) => string;
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
    if (onIntervalChanged) {
      // @ts-ignore
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
    const {
      onRefresh,
      intervals,
      tooltip,
      value,
      text,
      isLoading,
      noIntervalPicker,
      width,
      offOptionLabelMsg,
      offOptionAriaLabelMsg,
      offDescriptionAriaLabelMsg,
      onDescriptionAriaLabelMsg,
    } = this.props;

    const currentValue = value || '';
    const variant = this.getVariant();
    const translatedOffOption = {
      value: RefreshPicker.offOption.value,
      label: offOptionLabelMsg || RefreshPicker.offOption.label,
      ariaLabel: offOptionAriaLabelMsg || RefreshPicker.offOption.ariaLabel,
    };
    const options = intervalsToOptions({ intervals, offOption: translatedOffOption });
    const option = options.find(({ value }) => value === currentValue);
    let selectedValue = option || translatedOffOption;

    if (selectedValue.label === translatedOffOption.label) {
      selectedValue = { value: '' };
    }

    const durationAriaLabel = selectedValue.ariaLabel;
    const ariaLabel =
      selectedValue.value === ''
        ? offDescriptionAriaLabelMsg || 'Auto refresh turned off. Choose refresh time interval'
        : onDescriptionAriaLabelMsg?.(durationAriaLabel) ||
          `Choose refresh time interval with current interval ${durationAriaLabel} selected`;

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
            onChange={this.onChangeSelect as any}
            variant={variant}
            title="Set auto refresh interval"
            data-testid={selectors.components.RefreshPicker.intervalButtonV2}
            aria-label={ariaLabel}
          />
        )}
      </ButtonGroup>
    );
  }
}

export function intervalsToOptions({
  intervals = defaultIntervals,
  offOption = RefreshPicker.offOption,
}: { intervals?: string[]; offOption?: SelectableValue<string> } = {}): Array<SelectableValue<string>> {
  const options: Array<SelectableValue<string>> = intervals.map((interval) => {
    const duration = parseDuration(interval);
    const ariaLabel = formatDuration(duration);

    return {
      label: interval,
      value: interval,
      ariaLabel: ariaLabel,
    };
  });

  options.unshift(offOption);
  return options;
}

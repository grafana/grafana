import React, { PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { ButtonSelect } from '../Dropdown/ButtonSelect';
import { ButtonGroup, ToolbarButton, ToolbarButtonVariant } from '../Button';
import { selectors } from '@grafana/e2e-selectors';

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
}

export class RefreshPicker extends PureComponent<Props> {
  static offOption = { label: 'Off', value: '', ariaLabel: 'Turn off auto refresh' };
  static liveOption = { label: 'Live', value: 'LIVE', ariaLabel: 'Live' };
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
    return 'default';
  }

  render() {
    const { onRefresh, intervals, tooltip, value, text, isLoading, noIntervalPicker } = this.props;

    const currentValue = value || '';
    const variant = this.getVariant();
    const options = intervalsToOptions({ intervals });
    const option = options.find(({ value }) => value === currentValue);
    let selectedValue = option || RefreshPicker.offOption;

    if (selectedValue.label === RefreshPicker.offOption.label) {
      selectedValue = { value: '' };
    }

    return (
      <ButtonGroup className="refresh-picker">
        <ToolbarButton
          tooltip={tooltip}
          onClick={onRefresh}
          variant={variant}
          icon={isLoading ? 'fa fa-spinner' : 'sync'}
          data-testid={selectors.components.RefreshPicker.runButton}
        >
          {text}
        </ToolbarButton>
        {!noIntervalPicker && (
          <ButtonSelect
            value={selectedValue}
            options={options}
            onChange={this.onChangeSelect as any}
            variant={variant}
            aria-label={selectors.components.RefreshPicker.intervalButton}
          />
        )}
      </ButtonGroup>
    );
  }
}

const sanitizeLabel = (item: string | undefined) => {
  const timeUnits = {
    s: 'Second',
    m: 'Minute',
    h: 'Hour',
    d: 'Day',
  };
  const isInterval = /^([0-9]).*(s|m|h|d)$/gim.test(item as string);

  if (isInterval === false) {
    return item;
  }
  if (item !== undefined) {
    const newItem = item.split('');
    const unit = newItem.pop();

    if (Number(newItem.join('')) !== 1 && unit !== undefined) {
      return `${newItem.join('') + timeUnits[unit]}s`;
    }

    return newItem.join('') + timeUnits[unit!];
  } else {
    return '';
  }
};

export function intervalsToOptions({ intervals = defaultIntervals }: { intervals?: string[] } = {}): Array<
  SelectableValue<string>
> {
  const intervalsOrDefault = intervals || defaultIntervals;
  const options = intervalsOrDefault.map((interval) => ({
    label: interval,
    value: interval,
    ariaLabel: sanitizeLabel(interval),
  }));

  options.unshift(RefreshPicker.offOption);
  return options;
}

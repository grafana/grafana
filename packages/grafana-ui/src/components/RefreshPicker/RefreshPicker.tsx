import React, { PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { Tooltip } from '../Tooltip/Tooltip';
import { ButtonSelect } from '../Forms/Legacy/Select/ButtonSelect';
import { ButtonGroup, ButtonVariant, ToolbarButton } from '../Button';

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
  'aria-label'?: string;
}

export class RefreshPicker extends PureComponent<Props> {
  static offOption = { label: 'Off', value: '' };
  static liveOption = { label: 'Live', value: 'LIVE' };
  static isLive = (refreshInterval?: string): boolean => refreshInterval === RefreshPicker.liveOption.value;

  constructor(props: Props) {
    super(props);
  }

  intervalsToOptions = (intervals: string[] | undefined): Array<SelectableValue<string>> => {
    const intervalsOrDefault = intervals || defaultIntervals;
    const options = intervalsOrDefault.map((interval) => ({ label: interval, value: interval }));

    options.unshift(RefreshPicker.offOption);
    return options;
  };

  onChangeSelect = (item: SelectableValue<string>) => {
    const { onIntervalChanged } = this.props;
    if (onIntervalChanged) {
      // @ts-ignore
      onIntervalChanged(item.value);
    }
  };

  getVariant(): ButtonVariant | undefined {
    if (this.props.isLive) {
      return 'primary';
    }
    if (this.props.isLoading) {
      return 'destructive';
    }
    if (this.props.text) {
      return 'primary';
    }
    return undefined;
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
      'aria-label': ariaLabel,
    } = this.props;

    const options = this.intervalsToOptions(intervals);
    const currentValue = value || '';
    const variant = this.getVariant();

    let selectedValue = options.find((item) => item.value === currentValue) || RefreshPicker.offOption;

    if (selectedValue.label === RefreshPicker.offOption.label) {
      selectedValue = { value: '' };
    }

    return (
      <div className="refresh-picker">
        <ButtonGroup className="refresh-picker-buttons" noSpacing={true}>
          <Tooltip placement="top" content={tooltip!}>
            <ToolbarButton
              onClick={onRefresh}
              aria-label={ariaLabel}
              variant={variant}
              icon={isLoading ? 'fa fa-spinner' : 'sync'}
            >
              {text}
            </ToolbarButton>
          </Tooltip>
          {!noIntervalPicker && (
            <ButtonSelect
              value={selectedValue}
              options={options}
              onChange={this.onChangeSelect as any}
              maxMenuHeight={380}
              variant={variant}
            />
          )}
        </ButtonGroup>
      </div>
    );
  }
}

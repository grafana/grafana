import React, { Component } from 'react';
import { SelectableValue } from '@grafana/data';
import { Tooltip } from '../Tooltip/Tooltip';
import { Icon } from '../Icon/Icon';
import { ButtonSelect } from '../Forms/Legacy/Select/ButtonSelect';
import { ButtonGroup, ToolbarButton } from '../Button';

// Default intervals used in the refresh picker component
export const defaultIntervals = ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'];

export interface Props {
  intervals?: string[];
  onRefresh?: () => any;
  onIntervalChanged: (interval: string) => void;
  value?: string;
  tooltip?: string;
  // You can supply your own refresh button element. In that case onRefresh and tooltip are ignored.
  refreshButton?: React.ReactNode;
  buttonSelectClassName?: string;
}

export class RefreshPicker extends Component<Props> {
  static offOption = { label: 'Off', value: '' };

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

  shouldComponentUpdate(nextProps: Props) {
    const intervalsDiffer = nextProps.intervals?.some((interval, i) => this.props.intervals?.[i] !== interval);

    return (
      intervalsDiffer ||
      this.props.onRefresh !== nextProps.onRefresh ||
      this.props.onIntervalChanged !== nextProps.onIntervalChanged ||
      this.props.value !== nextProps.value ||
      this.props.tooltip !== nextProps.tooltip ||
      this.props.refreshButton !== nextProps.refreshButton ||
      this.props.buttonSelectClassName !== nextProps.buttonSelectClassName ||
      this.props.theme !== nextProps.theme
    );
  }

  render() {
    const { onRefresh, intervals, tooltip, value, refreshButton } = this.props;
    const options = this.intervalsToOptions(intervals);
    const currentValue = value || '';
    let selectedValue = options.find((item) => item.value === currentValue) || RefreshPicker.offOption;

    if (selectedValue.label === RefreshPicker.offOption.label) {
      selectedValue = { value: '' };
    }

    return (
      <div className="refresh-picker">
        <ButtonGroup className="refresh-picker-buttons" noSpacing={true}>
          {refreshButton ? (
            refreshButton
          ) : (
            <Tooltip placement="top" content={tooltip!}>
              <ToolbarButton onClick={onRefresh} className="button-group__button">
                <Icon name="sync" size="lg" />
              </ToolbarButton>
            </Tooltip>
          )}
          <ButtonSelect
            value={selectedValue}
            options={options}
            className="button-group__button"
            onChange={this.onChangeSelect as any}
            maxMenuHeight={380}
          />
        </ButtonGroup>
      </div>
    );
  }
}

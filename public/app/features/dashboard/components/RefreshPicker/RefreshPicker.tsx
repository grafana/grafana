import React, { PureComponent } from 'react';
import { ClickOutsideWrapper, SelectButton } from '@grafana/ui';

import { RefreshSelect, EMPTY_ITEM_TEXT } from './RefreshSelect';
import { RefreshButton } from './RefreshButton';

export interface Props {
  initialValue: string | undefined;
  intervals: string[];
  onRefreshClicked: () => void;
  onIntervalChanged: (interval: string) => void;
}

export interface State {
  value: string | undefined;
  isSelectOpen: boolean;
}

export class RefreshPicker extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { value: props.initialValue, isSelectOpen: false };
  }

  onSelectButtonClicked = () => {
    this.setState({ isSelectOpen: !this.state.isSelectOpen });
  };

  onSelectChanged = (interval: string) => {
    this.setState({ isSelectOpen: !this.state.isSelectOpen, value: interval });
    this.props.onIntervalChanged(interval);
  };

  onClickOutside = () => this.setState({ isSelectOpen: false });

  render() {
    const { onRefreshClicked, intervals } = this.props;
    const { isSelectOpen, value } = this.state;

    return (
      <ClickOutsideWrapper onClick={this.onClickOutside}>
        <div className="refresh-picker">
          <div className="refresh-picker-buttons">
            <RefreshButton onClick={onRefreshClicked} />
            <SelectButton onClick={this.onSelectButtonClicked} textWhenUndefined={EMPTY_ITEM_TEXT} value={value} />
          </div>
          <div className="refresh-picker-select">
            <RefreshSelect isOpen={isSelectOpen} intervals={intervals} onChange={this.onSelectChanged} value={value} />
          </div>
        </div>
      </ClickOutsideWrapper>
    );
  }
}

import React, { PureComponent } from 'react';
import { RefreshButton } from './RefreshButton';
import { RefreshSelect } from './RefreshSelect';
import { RefreshSelectButton } from './RefreshSelectButton';

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

  onRefreshButtonClicked = () => {
    this.setState({ isSelectOpen: !this.state.isSelectOpen });
  };

  onSelectChanged = (interval: string) => {
    this.setState({ isSelectOpen: !this.state.isSelectOpen, value: interval });
    this.props.onIntervalChanged(interval);
  };

  render() {
    const { onRefreshClicked, intervals } = this.props;
    const { isSelectOpen, value } = this.state;
    return (
      <div className={'refresh-picker'}>
        <div className={'refresh-picker-buttons'}>
          <RefreshButton onClick={onRefreshClicked} />
          <RefreshSelectButton value={value} onClick={this.onRefreshButtonClicked} />
        </div>
        <div className={'refresh-picker-select'}>
          <RefreshSelect isOpen={isSelectOpen} intervals={intervals} onChange={this.onSelectChanged} value={value} />
        </div>
      </div>
    );
  }
}

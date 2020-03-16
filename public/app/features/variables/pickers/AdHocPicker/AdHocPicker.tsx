import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { StoreState } from 'app/types';
import { VariablePickerProps } from '../types';
import { AdHocVariableModel } from 'app/features/templating/variable';

interface OwnProps extends VariablePickerProps<AdHocVariableModel> {}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export class AdHocPickerUnconnected extends PureComponent<Props> {
  render() {
    return <div className="variable-link-wrapper">asdf</div>;
  }
}
const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {};

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => ({});

export const AdHocPicker = connect(mapStateToProps, mapDispatchToProps)(AdHocPickerUnconnected);
AdHocPicker.displayName = 'AdHocPicker';

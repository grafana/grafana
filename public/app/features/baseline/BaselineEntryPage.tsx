import React from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useMount } from 'react-use';
import { hot } from 'react-hot-loader';
import { PageToolbar } from '@grafana/ui';
import { StoreState } from 'app/types';
import { initBaselineEntryPage, submitBaselineEntry } from './state/actions';
import BaselineEntryForm from './BaselineEntryForm';

export interface OwnProps {}

function mapStateToProps(state: StoreState) {
  const baselineEntryState = state.baseline;
  const { isUpdating } = baselineEntryState;
  return {
    isUpdating,
  };
}

const mapDispatchToProps = {
  initBaselineEntryPage,
  submitBaselineEntry,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

export function BaselineEntryPage({ isUpdating, initBaselineEntryPage, submitBaselineEntry }: Props) {
  useMount(() => initBaselineEntryPage());

  return (
    <div className="baseline-entry">
      <PageToolbar title={`Baseline Entry`} />
      <div className="sub-title">Possible microcopy providing high level explanation of the chart.</div>
      <BaselineEntryForm updateProfile={submitBaselineEntry} isSavingBaselineEntry={isUpdating} />
      <hr></hr>
    </div>
  );
}

export default hot(module)(connector(BaselineEntryPage));

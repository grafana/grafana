import React from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useMount } from 'react-use';
import { hot } from 'react-hot-loader';
import { PageToolbar, PageHeader, Tooltip, Icon, useStyles2 } from '@grafana/ui';
import { BaselineDTO, StoreState } from 'app/types';
import { initBaselineEntryPage, submitBaselineEntry } from './state/actions';
import BaselineEntryForm from './BaselineEntryForm';
import { getLoginStyles } from 'app/core/components/Login/LoginLayout';
import { Branding } from 'app/core/components/Branding/Branding';

export interface OwnProps {}

function mapStateToProps(state: StoreState) {
  const baselineEntryState = state.baseline;
  const { isUpdating, baselineEntries, baselineEntriesAreLoading } = baselineEntryState;
  return {
    isUpdating,
    baselineEntries,
    baselineEntriesAreLoading,
  };
}

const mapDispatchToProps = {
  initBaselineEntryPage,
  submitBaselineEntry,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

export function BaselineEntryPage({
  isUpdating,
  baselineEntries,
  baselineEntriesAreLoading,
  initBaselineEntryPage,
  submitBaselineEntry,
}: Props) {
  useMount(() => initBaselineEntryPage());

  const loginStyles = useStyles2(getLoginStyles);

  return (
    <div className="baseline-entry">
      <PageHeader title={`H&L Energy Optimisation Dashboard`} className="no-margin" pageIcon="graph-bar">
        <Branding.LoginLogo className={loginStyles.pageHeaderLogo} />
      </PageHeader>
      <PageToolbar title={`Baseline Entry`} className="no-margin" />
      <div className="sub-title">Possible microcopy providing high level explanation of the chart.</div>
      <BaselineEntryForm addBaselineEntry={submitBaselineEntry} isSavingBaselineEntry={isUpdating} />
      <hr className="spacious"></hr>
      <div className="baseline-entry-table-container">
        <table className="baseline-entry-table filter-table form-inline filter-table--hover">
          <thead>
            <tr>
              <th>No</th>
              <th>
                Start Date&nbsp;
                <Tooltip placement="top" content="Start Date">
                  <Icon name="shield" />
                </Tooltip>
              </th>
              <th>End Date</th>
              <th>No. of Days</th>
              <th>Kilowatt-hour</th>
              <th>Min. kW</th>
              <th>Max. kW</th>
              <th>Avg. kW</th>
              <th>Avg. kVA</th>
              <th>PF</th>
              <th>Min. PF</th>
              <th>Max. PF</th>
              <th>Rate</th>
              <th>Energy Rate</th>
              <th>Fuel Rate</th>
              <th>Fuel & IPP Rate</th>
              <th>IPP Var. Rate</th>
              <th>IPP Var. Charge</th>
              <th>Energy Charge</th>
              <th>Current Charges</th>
              {/* <th>
                Seen&nbsp;
                <Tooltip placement="top" content="Time since user was seen using Grafana">
                  <Icon name="question-circle" />
                </Tooltip>
              </th> */}
            </tr>
          </thead>
          <tbody>{baselineEntries.map(renderBaselineRecord)}</tbody>
        </table>
        {renderLoadingBaselineEntries(baselineEntriesAreLoading)}
      </div>
    </div>
  );
}

const renderLoadingBaselineEntries = (isLoading: boolean) => {
  let el;

  if (isLoading === true) {
    el = (
      <div className="baseline-data-loading-container">
        <div className="baseline-data-loading-msg">Loading...</div>
      </div>
    );
  } else {
    el = null;
  }
  return el;
};

const renderBaselineRecord = (baselineEntry: BaselineDTO) => {
  return (
    <tr key={baselineEntry.id}>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.id}>
          {baselineEntry.id}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.startDate}>
          {baselineEntry.startDate}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.endDate}>
          {baselineEntry.endDate}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.noOfDays}>
          {baselineEntry.noOfDays}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.kwh}>
          {baselineEntry.kwh}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.minKw}>
          {baselineEntry.minKw}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.maxKw}>
          {baselineEntry.maxKw}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.avgKw}>
          {baselineEntry.avgKw}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.avgKva}>
          {baselineEntry.avgKva}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.pf}>
          {baselineEntry.pf}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.minPf}>
          {baselineEntry.minPf}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.maxPf}>
          {baselineEntry.maxPf}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.rate}>
          {baselineEntry.rate}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.energyRate}>
          {baselineEntry.energyRate}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.fuelRate}>
          {baselineEntry.fuelRate}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.ippRate}>
          {baselineEntry.ippRate}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.ippVariableRate}>
          {baselineEntry.ippVariableRate}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.ippVariableCharge}>
          {baselineEntry.ippVariableCharge}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.energyCharge}>
          {baselineEntry.energyCharge}
        </a>
      </td>
      <td className="link-td max-width-10">
        <a className="ellipsis" title={baselineEntry.currentCharges}>
          {baselineEntry.currentCharges}
        </a>
      </td>
      {/* <td className="link-td">
        {baselineEntry.isAdmin && (
          <a href={editUrl}>
            <Tooltip placement="top" content="Grafana Admin">
              <Icon name="shield" />
            </Tooltip>
          </a>
        )}
      </td> */}
    </tr>
  );
};

export default hot(module)(connector(BaselineEntryPage));

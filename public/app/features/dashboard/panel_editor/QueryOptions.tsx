// Libraries
import React, { PureComponent, ChangeEvent, FocusEvent } from 'react';

// Utils
import { rangeUtil, PanelData, DataSourceApi } from '@grafana/data';

// Components
import {
  EventsWithValidation,
  LegacyInputStatus,
  LegacyForms,
  ValidationEvents,
  InlineFormLabel,
  stylesFactory,
} from '@grafana/ui';
const { Switch, Input } = LegacyForms;

// Types
import { PanelModel } from '../state';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { config } from 'app/core/config';
import { css } from 'emotion';

const timeRangeValidationEvents: ValidationEvents = {
  [EventsWithValidation.onBlur]: [
    {
      rule: value => {
        if (!value) {
          return true;
        }
        return rangeUtil.isValidTimeSpan(value);
      },
      errorMessage: 'Not a valid timespan',
    },
  ],
};

const emptyToNull = (value: string) => {
  return value === '' ? null : value;
};

interface Props {
  panel: PanelModel;
  dataSource: DataSourceApi;
  data: PanelData;
}

interface State {
  relativeTime: string;
  timeShift: string;
  cacheTimeout: string;
  maxDataPoints: number | string;
  interval: string;
  hideTimeOverride: boolean;
  isOpen: boolean;
}

export class QueryOptions extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      relativeTime: props.panel.timeFrom || '',
      timeShift: props.panel.timeShift || '',
      cacheTimeout: props.panel.cacheTimeout || '',
      maxDataPoints: props.panel.maxDataPoints ?? '',
      interval: props.panel.interval || '',
      hideTimeOverride: props.panel.hideTimeOverride || false,
      isOpen: false,
    };
  }

  onRelativeTimeChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      relativeTime: event.target.value,
    });
  };

  onTimeShiftChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      timeShift: event.target.value,
    });
  };

  onOverrideTime = (event: FocusEvent<HTMLInputElement>, status: LegacyInputStatus) => {
    const { value } = event.target;
    const { panel } = this.props;
    const emptyToNullValue = emptyToNull(value);

    if (status === LegacyInputStatus.Valid && panel.timeFrom !== emptyToNullValue) {
      panel.timeFrom = emptyToNullValue;
      panel.refresh();
    }
  };

  onTimeShift = (event: FocusEvent<HTMLInputElement>, status: LegacyInputStatus) => {
    const { value } = event.target;
    const { panel } = this.props;
    const emptyToNullValue = emptyToNull(value);

    if (status === LegacyInputStatus.Valid && panel.timeShift !== emptyToNullValue) {
      panel.timeShift = emptyToNullValue;
      panel.refresh();
    }
  };

  onToggleTimeOverride = () => {
    const { panel } = this.props;
    this.setState({ hideTimeOverride: !this.state.hideTimeOverride }, () => {
      panel.hideTimeOverride = this.state.hideTimeOverride;
      panel.refresh();
    });
  };

  onDataSourceOptionBlur = (panelKey: string) => () => {
    const { panel } = this.props;

    // @ts-ignore
    panel[panelKey] = this.state[panelKey];
    panel.refresh();
  };

  onDataSourceOptionChange = (panelKey: string) => (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ ...this.state, [panelKey]: event.target.value });
  };

  onMaxDataPointsBlur = () => {
    const { panel } = this.props;

    const maxDataPoints = parseInt(this.state.maxDataPoints as string, 10);

    if (isNaN(maxDataPoints)) {
      delete panel.maxDataPoints;
    } else {
      panel.maxDataPoints = maxDataPoints;
    }

    panel.refresh();
  };

  renderCacheTimeoutOption() {
    const { dataSource } = this.props;
    const { cacheTimeout } = this.state;
    const tooltip = `If your time series store has a query cache this option can override the default cache timeout. Specify a
    numeric value in seconds.`;

    if (!dataSource.meta.queryOptions?.cacheTimeout) {
      return null;
    }

    return (
      <div className="gf-form-inline">
        <div className="gf-form">
          <InlineFormLabel width={9} tooltip={tooltip}>
            Cache timeout
          </InlineFormLabel>
          <Input
            type="text"
            className="width-6"
            placeholder="60"
            name={name}
            spellCheck={false}
            onBlur={this.onDataSourceOptionBlur('cacheTimeout')}
            onChange={this.onDataSourceOptionChange('cacheTimeout')}
            value={cacheTimeout}
          />
        </div>
      </div>
    );
  }

  renderMaxDataPointsOption() {
    const { data } = this.props;
    const { maxDataPoints } = this.state;
    const realMd = data.request?.maxDataPoints;
    const isAuto = maxDataPoints === '';

    return (
      <div className="gf-form-inline">
        <div className="gf-form">
          <InlineFormLabel
            width={9}
            tooltip={
              <>
                The maximum data points per series. Used directly by some data sources and used in calculation of auto
                interval. With streaming data this value is used for the rolling buffer.
              </>
            }
          >
            Max data points
          </InlineFormLabel>
          <Input
            type="number"
            className="width-6"
            placeholder={`${realMd}`}
            name={name}
            spellCheck={false}
            onBlur={this.onMaxDataPointsBlur}
            onChange={this.onDataSourceOptionChange('maxDataPoints')}
            value={maxDataPoints}
          />
          {isAuto && (
            <>
              <div className="gf-form-label query-segment-operator">=</div>
              <div className="gf-form-label">Width of panel</div>
            </>
          )}
        </div>
      </div>
    );
  }

  renderIntervalOption() {
    const { data, dataSource } = this.props;
    const { interval } = this.state;
    const realInterval = data.request?.interval;
    const minIntervalOnDs = dataSource.interval ?? 'No limit';

    return (
      <>
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel
              width={9}
              tooltip={
                <>
                  A lower limit for the interval. Recommended to be set to write frequency, for example <code>1m</code>{' '}
                  if your data is written every minute. Default value can be set in data source settings for most data
                  sources.
                </>
              }
            >
              Min interval
            </InlineFormLabel>
            <Input
              type="text"
              className="width-6"
              placeholder={`${minIntervalOnDs}`}
              name={name}
              spellCheck={false}
              onBlur={this.onDataSourceOptionBlur('interval')}
              onChange={this.onDataSourceOptionChange('interval')}
              value={interval}
            />
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel
              width={9}
              tooltip={
                <>
                  The evaluated Interval that is sent to data source and is used in <code>$__interval</code> and{' '}
                  <code>$__interval_ms</code>
                </>
              }
            >
              Interval
            </InlineFormLabel>
            <InlineFormLabel width={6}>{realInterval}</InlineFormLabel>
            <div className="gf-form-label query-segment-operator">=</div>
            <div className="gf-form-label">Max data points / time range</div>
          </div>
        </div>
      </>
    );
  }

  onOpenOptions = () => {
    this.setState({ isOpen: true });
  };

  onCloseOptions = () => {
    this.setState({ isOpen: false });
  };

  renderCollapsedText(styles: StylesType): React.ReactNode | undefined {
    const { data } = this.props;
    const { isOpen, maxDataPoints, interval } = this.state;

    if (isOpen) {
      return undefined;
    }

    let mdDesc = maxDataPoints;
    if (maxDataPoints === '' && data.request) {
      mdDesc = `auto = ${data.request.maxDataPoints}`;
    }

    let intervalDesc = interval;
    if (data.request) {
      intervalDesc = `${data.request.interval}`;
    }

    return (
      <>
        {<div className={styles.collapsedText}>MD = {mdDesc}</div>}
        {<div className={styles.collapsedText}>Interval = {intervalDesc}</div>}
      </>
    );
  }

  render() {
    const { hideTimeOverride } = this.state;
    const { relativeTime, timeShift, isOpen } = this.state;
    const styles = getStyles();

    return (
      <QueryOperationRow
        id="Query options"
        index={0}
        title="Query options"
        headerElement={this.renderCollapsedText(styles)}
        isOpen={isOpen}
        onOpen={this.onOpenOptions}
        onClose={this.onCloseOptions}
      >
        {this.renderMaxDataPointsOption()}
        {this.renderIntervalOption()}
        {this.renderCacheTimeoutOption()}

        <div className="gf-form">
          <InlineFormLabel width={9}>Relative time</InlineFormLabel>
          <Input
            type="text"
            className="width-6"
            placeholder="1h"
            onChange={this.onRelativeTimeChange}
            onBlur={this.onOverrideTime}
            validationEvents={timeRangeValidationEvents}
            hideErrorMessage={true}
            value={relativeTime}
          />
        </div>

        <div className="gf-form">
          <span className="gf-form-label width-9">Time shift</span>
          <Input
            type="text"
            className="width-6"
            placeholder="1h"
            onChange={this.onTimeShiftChange}
            onBlur={this.onTimeShift}
            validationEvents={timeRangeValidationEvents}
            hideErrorMessage={true}
            value={timeShift}
          />
        </div>
        {(timeShift || relativeTime) && (
          <div className="gf-form-inline">
            <Switch
              label="Hide time info"
              labelClass="width-9"
              checked={hideTimeOverride}
              onChange={this.onToggleTimeOverride}
            />
          </div>
        )}
      </QueryOperationRow>
    );
  }
}

const getStyles = stylesFactory(() => {
  const { theme } = config;

  return {
    collapsedText: css`
      margin-left: ${theme.spacing.md};
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.textWeak};
    `,
  };
});

type StylesType = ReturnType<typeof getStyles>;

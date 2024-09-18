/* eslint-disable @typescript-eslint/consistent-type-assertions */
import React, { FC, useState, useEffect, useCallback, useMemo } from 'react';
import { Field, withTypes } from 'react-final-form';
import { useHistory } from 'react-router-dom';

import { SelectableValue, DateTime, dateTime, AppEvents, PageLayoutType } from '@grafana/data';
import { LinkButton, PageToolbar, DateTimePicker, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { SwitchRow } from 'app/percona/settings/components/Advanced/SwitchRow';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { MultiSelectField } from 'app/percona/shared/components/Form/MultiSelectField';
import { PMM_EXPORT_DUMP_PAGE } from 'app/percona/shared/components/PerconaBootstrapper/PerconaNavigation';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { triggerDumpAction } from 'app/percona/shared/core/reducers/pmmDump/pmmDump';
import { fetchActiveServiceTypesAction, fetchServicesAction } from 'app/percona/shared/core/reducers/services';
import { getServices } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { GET_SERVICES_CANCEL_TOKEN, DUMP_URL, TWELVE_HOURS } from './ExportDataset.constants';
import { Messages } from './ExportDataset.messages';
import { getStyles } from './ExportDataset.styles';
import { ExportDatasetProps } from './ExportDataset.types';

const { Form } = withTypes<ExportDatasetProps>();

const ExportDataset: FC<GrafanaRouteComponentProps<{ type: string; id: string }>> = ({ match }) => {
  const styles = useStyles2(getStyles);
  const dispatch = useAppDispatch();
  const { isLoading, services: fetchedServices } = useSelector(getServices);

  const serviceNames = useMemo(
    () =>
      fetchedServices.map<SelectableValue<string>>((data) => ({
        label: data.params.serviceName,
        value: data.params.serviceName,
      })),
    [fetchedServices]
  );

  const [generateToken] = useCancelToken();
  const [endDate, setEndDate] = useState<DateTime>(dateTime(new Date().setSeconds(0, 0)));
  const [startDate, setStartDate] = useState<DateTime>(
    dateTime(new Date(new Date(new Date().setSeconds(0, 0)).getTime() - TWELVE_HOURS))
  );
  const [dateError, setDateError] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      await Promise.all([
        dispatch(fetchServicesAction({ token: generateToken(GET_SERVICES_CANCEL_TOKEN) })),
        dispatch(fetchActiveServiceTypesAction()),
      ]);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      console.error(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const history = useHistory();
  const handleGoBack = () => {
    history.push(DUMP_URL);
  };

  const handleStartDate = (date: DateTime) => {
    if (dateTime(date) >= dateTime(endDate)) {
      appEvents.emit(AppEvents.alertError, [Messages.timeRangeValidation]);
      setDateError(true);
    } else {
      setDateError(false);
    }

    setStartDate(date);
  };

  const handleSubmit = async (data: ExportDatasetProps) => {
    let serviceList: string[];
    if (data && data.service) {
      serviceList = data.service.map(({ value }): string => value);
    } else {
      serviceList = [];
    }

    await dispatch(
      triggerDumpAction({
        serviceNames: serviceList,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        exportQan: !!data.QAN,
        ignoreLoad: !!data.load,
      })
    );
    history.push(DUMP_URL);
  };

  return (
    <Page navId={PMM_EXPORT_DUMP_PAGE.id} pageNav={PMM_EXPORT_DUMP_PAGE} layout={PageLayoutType.Custom}>
      <Page.Contents>
        <Form
          onSubmit={handleSubmit}
          render={({ handleSubmit, form }) => (
            <form onSubmit={handleSubmit} className={styles.form}>
              <PageToolbar title={Messages.breadCrumbTitle} onGoBack={handleGoBack}>
                <LinkButton href={DUMP_URL} data-testid="cancel-button" variant="secondary" fill="outline">
                  {Messages.cancel}
                </LinkButton>
              </PageToolbar>
              <div className={styles.contentOuter}>
                <div className={styles.contentInner}>
                  <div className={styles.pageWrapper}>
                    <div>{Messages.summary}</div>
                    <h3 className={styles.heading3Style}>{Messages.title}</h3>
                    <span className={styles.selectFieldWrap}>
                      <Field name="service">
                        {({ input }) => (
                          <MultiSelectField
                            {...input}
                            placeholder={!!serviceNames.length ? Messages.allServices : Messages.noService}
                            closeMenuOnSelect={false}
                            isClearable
                            label={Messages.selectServiceNames}
                            options={serviceNames}
                            {...input}
                            isLoading={isLoading}
                            className={styles.selectField}
                            data-testid="service-select-input"
                          />
                        )}
                      </Field>
                    </span>
                    <div className={styles.datePicker}>
                      <div>
                        {Messages.selectStart}
                        <div className={styles.selectFieldWrap}>
                          <DateTimePicker
                            label={Messages.date}
                            date={startDate}
                            onChange={(e) => handleStartDate(e!)}
                            maxDate={new Date()}
                            timepickerProps={{
                              showSecond: false,
                              hideDisabledOptions: true,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        {Messages.selectEnd}
                        <div className={styles.selectFieldWrap}>
                          <DateTimePicker
                            label={Messages.date}
                            date={endDate}
                            maxDate={new Date()}
                            onChange={(date) => setEndDate(date!)}
                            timepickerProps={{
                              showSecond: false,
                              hideDisabledOptions: true,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className={styles.switch}>
                      <Field
                        name="QAN"
                        type="checkbox"
                        tooltip={Messages.qanTootltip}
                        label={Messages.qan}
                        dataTestId="pmm-dump"
                        component={SwitchRow}
                      />

                      <Field
                        name="load"
                        type="checkbox"
                        label={Messages.ignoreLoad}
                        dataTestId="pmm-dump"
                        tooltip={Messages.ignoreLoadTooltip}
                        component={SwitchRow}
                      />
                    </div>
                    <div className={styles.submitButton}>
                      <LoaderButton
                        data-testid="create-dataset-submit-button"
                        size="md"
                        type="submit"
                        variant="primary"
                        disabled={!serviceNames.length || dateError}
                        loading={false}
                      >
                        {Messages.createDataset}
                      </LoaderButton>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        />
      </Page.Contents>
    </Page>
  );
};

export default ExportDataset;

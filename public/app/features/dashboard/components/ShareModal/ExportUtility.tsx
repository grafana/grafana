/*
 * @Author amulay
 * @Author kavraham
 * @Author bfakhera
 * @Author kmejdi
 *
 * Created on Jun 3, 2020
 * Copyright (C) 2021-2025 - BMC Helix Inc
 */

import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Button, Icon, RadioButtonGroup, Select, Spinner, InlineSwitch } from '@grafana/ui';
import { sceneGraph} from '@grafana/scenes';
import { config } from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
import { t, Trans } from 'app/core/internationalization';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { PDFLayout, PDFOrientation, ReportType } from 'app/features/reports/manage-report/types';
import { EnclosureMode, NewlineMode } from '@grafana/data/src/utils/csvOptions';
import { getFeatureStatus } from '../../services/featureFlagSrv';
import { replaceValueForLocale } from '../../utils/dashboard';

import { buildHostUrl } from './utils';
import { PanelModelCompatibilityWrapper } from 'app/features/dashboard-scene/utils/PanelModelCompatibilityWrapper';

const getDelimiterText = (del: string) => {
  switch (del) {
    case ',':
    case '':
      return `Comma ( , )`;
    case '|':
      return `Pipe ( | )`;
    case ':':
      return `Colon ( : )`;
    case ';':
      return `Semicolon ( ; )`;
    default:
      return `Delimiter ( ${del} )`;
  }
};
interface Props {
  dashboard: DashboardModel;
  panel?: PanelModel;
  onDismiss?(): void;
  //props for when used in scene
  isScene?: boolean;
  classNameWrapper?: string;
  selectWidth?: number;
}

const layoutOptions: Array<SelectableValue<PDFLayout>> = [
  { label: t('bmc.export.grid', 'Grid'), value: PDFLayout.GRID },
  { label: t('bmc.export.simple', 'Simple'), value: PDFLayout.SIMPLE },
];
const orientationOptions: Array<SelectableValue<PDFOrientation>> = [
  { label: t('bmc.export.portrait', 'Portrait'), value: PDFOrientation.PORTRAIT },
  { label: t('bmc.export.landscape', 'Landscape'), value: PDFOrientation.LANDSCAPE },
];
// Table column width scaling option to adjust widths.
const tableScalingOptions: Array<SelectableValue<any>> = [
  { label: 'Dynamic', value: false },
  { label: 'Fixed', value: true },
];
const defaultReportTypeOptions: Array<SelectableValue<ReportType>> = [
  { label: 'PDF', value: ReportType.PDF, fileType: 'application/pdf', fileExt: 'pdf' },
  {
    label: 'XLSX',
    value: ReportType.XLS,
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileExt: 'xlsx',
  },
  { label: 'CSV', value: ReportType.CSV, fileType: 'application/zip', fileExt: 'zip' },
];
const csvDelimiterOptions: Array<SelectableValue<string>> = ((config.bootData.settings as any).csvDelimiters ?? []).map(
  (item: string) => {
    return { label: getDelimiterText(item), value: item };
  }
);
const enclosedOptions: Array<SelectableValue<EnclosureMode>> = [
  { label: 'Default', value: EnclosureMode.Default },
  { label: 'Double quote', value: EnclosureMode.Double },
];

const newlineOptions: Array<SelectableValue<NewlineMode>> = [
  { label: 'CR', value: NewlineMode.CR },
  { label: 'CRLF', value: NewlineMode.CRLF },
  { label: 'LF', value: NewlineMode.LF },
];
interface PreviewDoc {
  uid: string;
  name: string;
  filter: string;
  layout: string;
  reportType: string;
  orientation: string;
  timeRange: string;
  timeRangeTo: string;
  timezone: string;
  theme: string;
  csvDelimiter: string;
  tableScaling: boolean;
  exportOptions?: {
    hideHeader?: boolean;
    enclosed?: EnclosureMode;
    newline?: NewlineMode;
  };
}

export interface State {
  selectedLayout: SelectableValue<PDFLayout>;
  selectedOrientation: SelectableValue<PDFOrientation>;
  selectedReportType: SelectableValue<ReportType>;

  isProcessing: boolean;
  isDownload: boolean;
  isPreview: boolean;
  isFixedLayout: boolean;
  csvDelimiter: SelectableValue<string>;
  exportOptions: {
    hideHeader: boolean;
    enclosed: EnclosureMode;
    newline: NewlineMode;
  };
}

const ExportUtility: React.FC<Props> = (props) => {
  const notifyApp = useAppNotification();
  const reportTypeOptions = getDashReportTypes(props.dashboard, props.panel);
  //destructure props and set defaults for non - scene usage
  const { isScene = false, classNameWrapper = 'width-16', selectWidth = isScene ? undefined : 32 } = props;

  const [state, setState] = React.useState<State>({
    selectedLayout: layoutOptions[0],
    selectedOrientation: orientationOptions[0],
    selectedReportType: reportTypeOptions[0],
    isProcessing: false,
    isDownload: false,
    isPreview: false,
    csvDelimiter: csvDelimiterOptions[0],
    isFixedLayout: false,
    exportOptions: { hideHeader: false, enclosed: EnclosureMode.Default, newline: NewlineMode.CRLF },
  });

  const showTableScaling: boolean = showTableScalingOption(props, state);

  const getVariables = (): string => {
    return location.search
      .slice(1, location.search.length)
      .split('&')
      .filter((e) => e.includes('var'))
      .join('&');
  };

  const exportToDoc = async (openInNewTab: boolean) => {
    setState({ ...state, isProcessing: true, isPreview: openInNewTab, isDownload: !openInNewTab });

    let variables = getVariables();

    if (props.panel) {
      // Change for identifying if panel is a repeat panel or not
      const isRepeatPanel = props.panel?.key.includes('clone');
      const panelIdentifier = isScene && isRepeatPanel ? props.panel?.key : props.panel?.id;
      variables += `&viewPanel=${panelIdentifier}&type=${props.panel.type}`;
    }

    if (isScene) {
      const pagePerRecord = (props.dashboard.getVariables() ?? []).find(
        (v) => v.name === 'pdf_per_record' && v.type === 'constant'
      );
      if (!variables.includes('pdf_per_record') && pagePerRecord) {
        variables += `&var-pdf_per_record=${(pagePerRecord as any).value}`;
      }
    }

    const layout = state.selectedLayout.value;
    const orientation = state.selectedOrientation.value;
    const reportType = state.selectedReportType?.value?.toLowerCase();
    // Get browser timezone with Intl
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezone = props.dashboard.getTimezone() === 'browser' ? browserTz : props.dashboard.getTimezone();

    let panelTitle = props.panel?.title;
    if (isScene && props.panel instanceof PanelModelCompatibilityWrapper) {
        panelTitle = sceneGraph.interpolate(props.panel._vizPanel, `${props.panel.title ?? ''}`);
    }
    if (panelTitle && getFeatureStatus('bhd-localization') && !isScene) {
      panelTitle = replaceValueForLocale(panelTitle, props.dashboard.getCurrentLocales());
    }
    const payload: PreviewDoc = {
      name:
        panelTitle ??
        (getFeatureStatus('bhd-localization')
          ? t(`bmc-dynamic.${props.dashboard.uid}.name`, props.dashboard.title)
          : props.dashboard.title),
      uid: props.dashboard.uid,
      reportType: reportType ?? ReportType.PDF,
      layout: layout ?? PDFLayout.GRID,
      orientation: orientation ?? PDFOrientation.PORTRAIT,
      theme: config.theme.type,
      timezone: timezone,
      timeRange: props.dashboard.time.from,
      timeRangeTo: props.dashboard.time.to,
      filter: variables,
      csvDelimiter: reportType === ReportType.CSV ? (state.csvDelimiter?.value ?? '') : '',
      tableScaling: reportType === ReportType.PDF ? state.isFixedLayout : false,
      ...(reportType === ReportType.CSV
        ? {
            exportOptions: {
              hideHeader: !!state.exportOptions?.hideHeader,
              enclosed: state.exportOptions?.enclosed ?? EnclosureMode.Default,
              newline: state.exportOptions?.newline ?? NewlineMode.CRLF,
            },
          }
        : {}),
    };

    await exportDocument(payload, openInNewTab, () => {
      setState({ ...state, isProcessing: false, isDownload: false, isPreview: false });
    });
  };

  const errorMsg = (msg?: string): string => {
    let variable: any = props.dashboard.getVariables().find((t) => t.id === 'pdf_per_record');
    if (variable !== undefined && variable?.query !== '') {
      const returnText = t(
        'bmc.export.reduce-selection',
        'Please reduce selected variable values for {{variableQuery}} and try again later',
        { variableQuery: variable.query }
      );
      return returnText;
    }
    if (msg !== undefined && msg !== '') {
      return msg;
    }
    return t('bmc.export.generation-failed', 'Failed to generate report, try again later');
  };

  const exportDocument = async (payload: any, openInNewTab: boolean, callback: () => void): Promise<void> => {
    try {
      const res = await fetch(`${buildHostUrl()}/api/reports/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let jdata = await res.json().catch(() => {});
        notifyApp.error(errorMsg(jdata?.message));
        callback();
        return;
      }

      const reportType = state.selectedReportType!;

      let fileName = `${payload.name} Preview`;
      let fileExt = (reportType as any).fileExt;
      let fileType = (reportType as any).fileType;

      const result = await res.blob();
      const buffer = await result.arrayBuffer();
      const blob = new Blob([buffer], {
        type: fileType,
      });
      const link = document.createElement('a');
      const href = window.URL.createObjectURL(blob);

      notifyApp.success(t('bmc.export.success', 'Successfully generated report'));

      link.setAttribute('href', href);
      link.setAttribute('target', openInNewTab ? '_blank' : '_self');
      if (!openInNewTab) {
        link.setAttribute('download', `${fileName}.${fileExt}`);
      }
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      notifyApp.error(errorMsg());
    } finally {
      callback();
    }
  };

  const onReportTypeChange = (value: SelectableValue<ReportType>) => {
    setState({ ...state, selectedReportType: value });
  };

  const onOrientationChange = (value: PDFOrientation) => {
    const selected = orientationOptions.find((e) => e.value === value) as SelectableValue<PDFOrientation>;
    setState({ ...state, selectedOrientation: selected });
  };

  const onLayoutChange = (value: PDFLayout) => {
    const selected = layoutOptions.find((e) => e.value === value) as SelectableValue<PDFLayout>;
    setState({ ...state, selectedLayout: selected });
  };

  const { selectedLayout, selectedOrientation, selectedReportType, isProcessing, isDownload, isPreview } = state;
  const target = props.panel ? 'panel' : 'dashboard';
  const type = selectedReportType?.label;
  let title = t('bmc.export.save-as', 'Save the {{target}} as {{type}}', { target, type });
  title = title.charAt(0).toUpperCase() + title.substring(1);
  const { onDismiss } = props;

  const isTablePanel =
    props.panel?.type === 'table' ||
    props.panel?.type === 'table-old' ||
    props.panel?.type === 'bmc-ade-cross-tab' ||
    props.panel?.type === 'bmc-table-panel';
  const shouldShowLayout = (!isTablePanel || !props.panel) && selectedReportType?.value === ReportType.PDF;
  const shouldShowOrientation = selectedReportType?.value === ReportType.PDF;
  const { isFixedLayout } = state;

  return (
    <div className="share-modal-body">
      <div className="share-modal-header">
        {!isScene && <Icon name="save" size="xxl" className="share-modal-big-icon" />}
        <div className="share-modal-content">
          <h5 className="share-modal-info-text" style={{ paddingBottom: '24px' }}>
            {title}
          </h5>
          <div className="gf-form">
            <label className="gf-form-label width-8" htmlFor="report-type">
              <Trans i18nKey="bmc.export.type">Type</Trans>
            </label>
            <div className={classNameWrapper}>
              <Select
                id="report-type"
                //Accessibility Change : Added aria-label
                aria-label="Select report type"
                //Accessibility Change End
                width={selectWidth}
                options={reportTypeOptions}
                defaultValue={reportTypeOptions[0]}
                value={state.selectedReportType}
                placeholder={'Select a report type'}
                onChange={onReportTypeChange}
              />
            </div>
          </div>
          {selectedReportType?.value === ReportType.CSV ? (
            <>
              <div className="gf-form">
                <label className="gf-form-label width-8" htmlFor="csv-delimiter">
                  <Trans i18nKey="bmc.export.csvdelimiter">Delimiter</Trans>
                </label>
                <div className={classNameWrapper}>
                  <Select
                    id="csv-delimiter"
                    width={selectWidth}
                    options={csvDelimiterOptions}
                    defaultValue={csvDelimiterOptions[0]}
                    value={state.csvDelimiter}
                    onChange={(value: SelectableValue<string>) => {
                      setState({ ...state, csvDelimiter: value });
                    }}
                  />
                </div>
              </div>

              <div className="gf-form">
                <label className="gf-form-label width-8" htmlFor="csv-hide-header">
                  <Trans i18nKey="bmc.export.hide-header">Hide header</Trans>
                </label>
                <div className="width-16">
                  <InlineSwitch
                    id="csv-hide-header"
                    value={state.exportOptions.hideHeader}
                    onChange={(e) =>
                      setState({
                        ...state,
                        exportOptions: { ...state.exportOptions, hideHeader: e.currentTarget.checked },
                      })
                    }
                  />
                </div>
              </div>

              <div className="gf-form">
                <label className="gf-form-label width-8" htmlFor="csv-enclosed">
                  <Trans i18nKey="bmc.export.field-enclosure">Field enclosure</Trans>
                </label>
                <div className="width-16">
                  <Select
                    id="csv-enclosed"
                    width={32}
                    options={enclosedOptions}
                    value={enclosedOptions.find((o) => o.value === state.exportOptions.enclosed)}
                    onChange={(value: SelectableValue<EnclosureMode>) =>
                      setState({
                        ...state,
                        exportOptions: { ...state.exportOptions, enclosed: value?.value ?? EnclosureMode.Default },
                      })
                    }
                    isClearable={false}
                  />
                </div>
              </div>

              <div className="gf-form">
                <label className="gf-form-label width-8" htmlFor="csv-newline">
                  <Trans i18nKey="bmc.export.newline">New line format</Trans>
                </label>
                <div className="width-16">
                  <Select
                    id="csv-newline"
                    width={32}
                    options={newlineOptions}
                    value={newlineOptions.find((o) => o.value === state.exportOptions.newline)}
                    onChange={(value: SelectableValue<NewlineMode>) =>
                      setState({
                        ...state,
                        exportOptions: { ...state.exportOptions, newline: value?.value ?? NewlineMode.CRLF },
                      })
                    }
                    isClearable={false}
                  />
                </div>
              </div>
            </>
          ) : null}
          {shouldShowLayout && (
            <div className="gf-form">
              <label className="gf-form-label width-8" htmlFor="layout">
                <Trans i18nKey="bmc.export.layout">Layout</Trans>
              </label>
              <div className={classNameWrapper}>
                <RadioButtonGroup
                  id="layout"
                  options={layoutOptions}
                  value={selectedLayout.value}
                  onChange={onLayoutChange}
                  fullWidth
                />
              </div>
            </div>
          )}
          {shouldShowOrientation && (
            <div className="gf-form">
              <label className="gf-form-label width-8" htmlFor="orientation">
                <Trans i18nKey="bmc.export.orientation">Orientation</Trans>
              </label>
              <div className={classNameWrapper}>
                <RadioButtonGroup
                  id="orientation"
                  options={orientationOptions}
                  value={selectedOrientation.value}
                  onChange={onOrientationChange}
                  fullWidth
                />
              </div>
            </div>
          )}
          {selectedReportType?.value === ReportType.PDF && showTableScaling ? (
            <div className="gf-form">
              <label className="gf-form-label" htmlFor="pdf-table-scaling" style={{ minWidth: '128px' }}>
                <Trans i18nKey="bmc.export.tableScaling">Table scaling</Trans>
              </label>
              <div className={classNameWrapper}>
                <RadioButtonGroup
                  id="pdf-table-scaling"
                  options={tableScalingOptions}
                  value={isFixedLayout}
                  onChange={() => {
                    setState({ ...state, isFixedLayout: !state.isFixedLayout });
                  }}
                  fullWidth
                />
              </div>
            </div>
          ) : null}
          {/*Separator added to match other share options */}
          {isScene && <hr />}

          {/* Remove extra padding above the button */}
          <div className="gf-form-button-row" style={isScene ? { paddingTop: 0 } : {}}>
            <Button
              variant="primary"
              disabled={isProcessing || !selectedReportType}
              onClick={() => exportToDoc(false)}
              id="getDocument"
            >
              <Trans i18nKey="bmc.common.download">Download</Trans> {type}
              {isProcessing && isDownload && <Spinner inline={true} style={{ paddingLeft: '8px' }}></Spinner>}
            </Button>
            {selectedReportType?.value === ReportType.PDF && (
              <Button
                variant="secondary"
                disabled={isProcessing || !selectedReportType}
                onClick={() => exportToDoc(true)}
                id="viewDocument"
              >
                <Trans i18nKey="bmc.export.view">View</Trans> {type}
                {isProcessing && isPreview && <Spinner inline={true} style={{ paddingLeft: '8px' }}></Spinner>}
              </Button>
            )}
            <Button variant="secondary" onClick={onDismiss} id="cancel">
              <Trans i18nKey="bmc.common.cancel">Cancel</Trans>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const getDashReportTypes = (dashboard: any, panel: any): any => {
  let ALL_REPORT_TYPES = [ReportType.PDF, ReportType.XLS, ReportType.CSV];
  let ALL_OPTIONS = defaultReportTypeOptions;

  if (panel) {
    const canCSV = panel.type === 'table' || panel.type === 'table-old' || panel.type === 'bmc-table-panel';
    if (canCSV) {
      return ALL_OPTIONS;
    }
    return ALL_OPTIONS.filter((e) => e.value !== ReportType.CSV);
  }

  const canCSV = dashboard.panels.some(
    (panel: any) => panel.type === 'table' || panel.type === 'table-old' || panel.type === 'bmc-table-panel'
  );
  if (!canCSV) {
    ALL_OPTIONS = ALL_OPTIONS.filter((e) => e.value !== ReportType.CSV);
  }

  const rule = dashboard.getVariables().find((v: any) => v.name === 'supported_report_types');
  if (!rule) {
    return ALL_OPTIONS;
  }

  const options = rule.options
    .map((o: any) => o.value.toLowerCase())
    .filter((o: any) => ALL_REPORT_TYPES.includes(o.toLowerCase()));

  if (options.length === 0) {
    return ALL_OPTIONS;
  }

  return ALL_OPTIONS.filter((e) => options.includes(e.value));
};

const showTableScalingOption = (props: any, state: any): boolean => {
  let showScaling = false;
  if (
    props.panel &&
    (props.panel.type === 'table' || props.panel.type === 'table-old' || props.panel.type === 'bmc-table-panel')
  ) {
    showScaling = true;
  } else {
    showScaling =
      props.dashboard.panels.some(
        (panel: any) => panel.type === 'table' || panel.type === 'table-old' || panel.type === 'bmc-table-panel'
      ) && state.selectedLayout.value === PDFLayout.SIMPLE;
  }
  return showScaling;
};

export default ExportUtility;

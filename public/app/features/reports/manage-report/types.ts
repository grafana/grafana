export type PeriodType = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute';

export enum ReportManageMode {
  NEW = 'new',
  EDIT = 'edit',
  CLONE = 'clone',
}

export enum ReportType {
  PDF = 'pdf',
  CSV = 'csv',
  XLS = 'xls',
}

export enum PDFOrientation {
  PORTRAIT = 'portrait',
  LANDSCAPE = 'landscape',
}

export enum PDFLayout {
  SIMPLE = 'simple',
  GRID = 'grid',
}

export enum PDFTheme {
  DARK = 'dark',
  LIGHT = 'light',
}

export interface ReportFormTypeItem {
  label: string;
  value: ReportType;
}

export interface ReportFormOrientationItem {
  label: string;
  value: PDFOrientation;
}

export interface ReportFormLayoutItem {
  label: string;
  value: PDFLayout;
}

export interface ReportFormFrequencyItem {
  label: string;
  value: PeriodType;
}

export interface ReportFormThemeItem {
  label: string;
  value: PDFTheme;
}

export interface ReportMonthItem {
  label: string;
  value: number;
}

export interface ReportFilterItem {
  label: string;
  value: string;
  description?: string;
}

export interface ReportDayItem {
  label: string;
  value: number;
}

export interface ReportTimezoneItem {
  label: string;
  value: string;
}

export interface ReportDashboardItem {
  label: string;
  value: number;
  uid: string;
}

export interface ReportRecipientItem {
  label: string;
  value: string;
  description?: string;
  imgUrl?: string;
}

export interface ReportBCCRecipientItem {
  label: string;
  value: string;
  description?: string;
  imgUrl?: string;
}

export interface ReportTimeRangeItem {
  label: string;
  value: string;
}

export interface Scheduler {
  frequency: number;
  days?: number[];
  time?: string;
  timezone: string;
  cron?: string;
}

export interface ReportDynamicRecipientDashItem {
  label: string;
  value: number;
  uid: string;
}

export interface ReportDistributionState {
  dashboardsOptions: ReportDashboardItem[];
  recipientsCustomOptions: ReportRecipientItem[];
  recipientsOptions: ReportRecipientItem[];
  bccRecipientsOptions: ReportBCCRecipientItem[];
  frequencyOptions: ReportFormFrequencyItem[];
  orientationOptions: ReportFormOrientationItem[];
  layoutOptions: ReportFormLayoutItem[];
  themeOptions: ReportFormThemeItem[];
  weekDaysOptions: ReportDayItem[];
  monthsOptions: ReportMonthItem[];
  timezonesOptions: ReportTimezoneItem[];
  timeRangeOptions: ReportTimeRangeItem[];
  filterOptions: ReportFilterItem[];
  dashboardFilters: ReportFilterItem[];
  dynamicRecipientDash: ReportDynamicRecipientDashItem[];
}

export interface ReportFormDTO {
  id?: number;
  name: string;
  enabled: boolean;
  description: string;
  dashboard: ReportDashboardItem;
  subject: string;
  recipients: ReportRecipientItem[];
  bccRecipients: ReportBCCRecipientItem[];
  message: string;
  orientation: string;
  layout: string;
  theme: string;
  period: PeriodType;
  months: ReportMonthItem[];
  monthDays: string;
  weekDays: ReportDayItem[];
  hours: string;
  minutes: number;
  timezone: ReportTimezoneItem;
  timeRange: ReportTimeRangeItem;
  filter: ReportFilterItem;
  reportType: string;
  recipientMode: string;
  isDynamicBccRecipient: boolean;
  dynamicRecipientDash: ReportDynamicRecipientDashItem;
}

// Report object for sending to the backened
export interface ReportDTO {
  id?: number;
  name: string;
  description: string;
  dashboardId: number;
  subject: string;
  recipients: string[];
  bccRecipients: string[];
  message: string;
  orientation: string;
  layout: string;
  theme: string;
  cron: string;
  enabled: boolean;
  timezone: string;
  timeRange: string;
  filter: string;
  reportType: string;
  recipientMode: string;
  isDynamicBccRecipient: boolean;
  dynamicRecipientDashId: number;
}

// Report object recieved from the backened
export interface Report {
  id?: number;
  name: string;
  description: string;
  dashboardId: number;
  subject: string;
  recipients: string[];
  bccRecipients: string[];
  message: string;
  orientation: string;
  theme: string;
  layout: string;
  cron: string;
  timezone: string;
  timeRange: string;
  filter: string;
  reportType: string;
  enable: boolean;
  checked?: boolean;
  recipientMode: string;
  isDynamicBccRecipient: boolean;
  dynamicRecipientDashId: number;
}

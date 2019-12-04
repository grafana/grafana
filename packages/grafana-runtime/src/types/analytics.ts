export interface MetaAnalyticsEventPayload {
  dashboardId?: number;
  dashboardUid?: string;
  dashboardName?: string;
  folderName?: string;
  panelId?: number;
  panelName?: string;
  datasourceName: string;
  datasourceId?: number;
  error?: string;
  duration: number;
  dataSize?: number;
}

export interface PerformanceEvent extends EchoEvent<EchoEventType.Performance, PerformanceEventPayload> {}

reporteMA = (payload, meta) => {
  getEchoSrv().addEvent({
    type: 'metaanal',
  });
};

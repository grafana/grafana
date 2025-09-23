export interface ExportDatasetProps {
  id: string;
  service: Service[];
  load: boolean;
  QAN: boolean;
}

export interface Timeranges {
  startTimestamp: string;
  endTimestamp: string;
}

export interface Service {
  label: string;
  value: string;
}

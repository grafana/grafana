export interface AdvancedFormProps {
  retention: number | string;
  telemetry: boolean;
  updates: boolean;
  backup: boolean;
  stt: boolean;
  publicAddress?: string;
  alerting?: boolean;
  azureDiscover?: boolean;
  rareInterval: string;
  standardInterval: string;
  frequentInterval: string;
  telemetrySummaries: string[];
  accessControl?: boolean;
}

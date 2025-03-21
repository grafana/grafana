import { Annotations, Labels } from '../common';

export interface ActiveNotification {
  receivers: NotificationReceiver[];
  fingerprint: string;
  startsAt: string; // ISO8601 timestamp for when the alert started
  endsAt?: string; // Optional: ISO8601 timestamp for when the alert ended
  updatedAt: string;
  annotations: Annotations;
  status: NotificationStatus;
  generatorURL: string;
  labels: Labels;
}

interface NotificationReceiver {
  name: string;
}

interface NotificationStatus {
  inhibitedBy: string[];
  silencedBy: string[];
  mutedBy: string[];
  state: string;
}

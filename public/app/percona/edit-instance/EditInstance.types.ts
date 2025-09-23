export interface EditInstanceRouteParams {
  serviceId: string;
}

export interface EditInstanceFormValues {
  environment?: string;
  cluster?: string;
  replication_set?: string;
  custom_labels?: string;
}

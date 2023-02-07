import { FormApi } from 'final-form';

import { SelectableValue } from '@grafana/data';

export interface RestoreFromProps {
  form: FormApi;
}

export enum RestoreFields {
  restoreFrom = 'restoreFrom',
  backupArtifact = 'backupArtifact',
  secretsName = 'secretsName',
}

export interface RestoreFieldsProps {
  [RestoreFields.restoreFrom]?: SelectableValue<string>;

  [RestoreFields.backupArtifact]?: SelectableValue<string>;
  [RestoreFields.secretsName]?: SelectableValue<string>;
}

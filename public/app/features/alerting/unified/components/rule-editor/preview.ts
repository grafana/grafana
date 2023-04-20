import { DataFrame } from '@grafana/data';

import { GrafanaAlertState, isGrafanaAlertState, Labels } from '../../../../../types/unified-alerting-dto';

interface AlertPreviewInstance {
  state: GrafanaAlertState;
  info?: string;
  labels: Labels;
}

interface AlertPreview {
  instances: AlertPreviewInstance[];
}

// Alerts previews come in a DataFrame format which is more suited for displaying time series data
// In order to display a list of tags we need to transform DataFrame into set of labels
export function mapDataFrameToAlertPreview({ fields }: DataFrame): AlertPreview {
  const labelFields = fields.filter((field) => !['State', 'Info'].includes(field.name));
  const stateFieldIndex = fields.findIndex((field) => field.name === 'State');
  const infoFieldIndex = fields.findIndex((field) => field.name === 'Info');

  const labelIndexes = labelFields.map((labelField) => fields.indexOf(labelField));

  const instanceStatusCount = fields[stateFieldIndex]?.values.length ?? 0;

  const instances: AlertPreviewInstance[] = [];

  for (let index = 0; index < instanceStatusCount; index++) {
    const labelValues = labelIndexes.map((labelIndex) => [fields[labelIndex].name, fields[labelIndex].values[index]]);
    const state = fields[stateFieldIndex]?.values?.get(index);
    const info = fields[infoFieldIndex]?.values?.get(index);

    if (isGrafanaAlertState(state)) {
      instances.push({
        state: state,
        info: info,
        labels: Object.fromEntries(labelValues),
      });
    }
  }

  return { instances };
}

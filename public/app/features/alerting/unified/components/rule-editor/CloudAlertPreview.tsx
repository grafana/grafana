import { css } from '@emotion/css';
import { max } from 'lodash';
import React from 'react';

import { DataFrame, GrafanaTheme2 } from '@grafana/data/src';
import { Icon, TagList, Tooltip, useStyles2 } from '@grafana/ui/src';

import { GrafanaAlertState, isGrafanaAlertState, Labels } from '../../../../../types/unified-alerting-dto';
import { AlertStateTag } from '../rules/AlertStateTag';

interface AlertPreviewInstance {
  state: GrafanaAlertState;
  info?: string;
  labels: Labels;
}

interface AlertPreview {
  instances: AlertPreviewInstance[];
}

function mapDataFrameToAlertPreview({ fields }: DataFrame): AlertPreview {
  const labelFields = fields.filter((field) => !['State', 'Info'].includes(field.name));
  const stateFieldIndex = fields.findIndex((field) => field.name === 'State');
  const infoFieldIndex = fields.findIndex((field) => field.name === 'Info');

  const labelIndexes = labelFields.map((labelField) => fields.indexOf(labelField));

  const maxValues = max(fields.map((f) => f.values.length)) ?? 0;

  const instances: AlertPreviewInstance[] = [];

  for (let index = 0; index < maxValues; index++) {
    const labelValues = labelIndexes.map((labelIndex) => [
      fields[labelIndex].name,
      fields[labelIndex].values.get(index),
    ]);
    const state = fields[stateFieldIndex].values.get(index);
    const info = fields[infoFieldIndex].values.get(index);

    if (labelValues.length > 0 && isGrafanaAlertState(state)) {
      instances.push({
        state: state,
        info: info,
        labels: Object.fromEntries(labelValues),
      });
    }
  }

  return { instances };
}

interface CloudAlertPreviewProps {
  previewSeries: DataFrame[];
}

export function CloudAlertPreview({ previewSeries }: CloudAlertPreviewProps) {
  const styles = useStyles2(getStyles);

  return (
    <>
      {previewSeries.map(mapDataFrameToAlertPreview).map(({ instances }, index) => {
        return (
          <table key={index} className={styles.table}>
            <thead>
              <tr>
                <th>State</th>
                <th>Labels</th>
                <th>Info</th>
              </tr>
            </thead>
            <tbody>
              {instances.map(({ state, info, labels }) => {
                return (
                  <tr key={index}>
                    <td>{<AlertStateTag state={state} />}</td>
                    <td>
                      <TagList tags={Object.entries(labels).map(([key, value]) => `${key}=${value}`)} />
                    </td>
                    <td>
                      {info && (
                        <Tooltip content={info}>
                          <Icon name="info-circle" />
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );
      })}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css`
    width: 100%;

    td,
    th {
      padding: ${theme.spacing(1, 0)};
    }

    td + td,
    th + th {
      padding-left: ${theme.spacing(1)};
    }

    thead th:nth-child(1) {
      width: 80px;
    }

    thead th:nth-child(2) {
      width: auto;
    }

    thead th:nth-child(3) {
      width: 40px;
    }

    td:nth-child(3) {
      text-align: center;
    }

    tbody tr:nth-child(2n + 1) {
      background-color: ${theme.colors.background.secondary};
    }
  `,
});

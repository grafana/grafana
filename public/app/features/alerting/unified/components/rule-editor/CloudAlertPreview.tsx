import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, GrafanaTheme2 } from '@grafana/data/src';
import { Icon, TagList, Tooltip, useStyles2 } from '@grafana/ui/src';

import { labelsToTags } from '../../utils/labels';
import { AlertStateTag } from '../rules/AlertStateTag';

import { mapDataFrameToAlertPreview } from './preview';

interface CloudAlertPreviewProps {
  preview: DataFrame;
}

export function CloudAlertPreview({ preview }: CloudAlertPreviewProps) {
  const styles = useStyles2(getStyles);
  const alertPreview = mapDataFrameToAlertPreview(preview);

  return (
    <table className={styles.table}>
      <caption>
        <div>Alerts preview</div>
        <span>Preview based on the result of running the query for this moment.</span>
      </caption>
      <thead>
        <tr>
          <th>State</th>
          <th>Labels</th>
          <th>Info</th>
        </tr>
      </thead>
      <tbody>
        {alertPreview.instances.map(({ state, info, labels }, index) => {
          const instanceTags = labelsToTags(labels);

          return (
            <tr key={index}>
              <td>{<AlertStateTag state={state} />}</td>
              <td>
                <TagList tags={instanceTags} className={styles.tagList} />
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
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css`
    width: 100%;
    margin: ${theme.spacing(2, 0)};

    caption {
      caption-side: top;
      color: ${theme.colors.text.primary};

      & > span {
        font-size: ${theme.typography.bodySmall.fontSize};
        color: ${theme.colors.text.secondary};
      }
    }

    td,
    th {
      padding: ${theme.spacing(1, 1)};
    }

    td + td,
    th + th {
      padding-left: ${theme.spacing(3)};
    }

    thead th {
      &:nth-child(1) {
        width: 80px;
      }

      &:nth-child(2) {
        width: auto;
      }

      &:nth-child(3) {
        width: 40px;
      }
    }

    td:nth-child(3) {
      text-align: center;
    }

    tbody tr:nth-child(2n + 1) {
      background-color: ${theme.colors.background.secondary};
    }
  `,
  tagList: css`
    justify-content: flex-start;
  `,
});

import { css } from '@emotion/css';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, TagList, Tooltip, useStyles2 } from '@grafana/ui';

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
        <div>
          <Trans i18nKey="alerting.cloud-alert-preview.alerts-preview">Alerts preview</Trans>
        </div>
        <span>
          <Trans i18nKey="alerting.cloud-alert-preview.running-query-preview">
            Preview based on the result of running the query for this moment.
          </Trans>
        </span>
      </caption>
      <thead>
        <tr>
          <th>
            <Trans i18nKey="alerting.cloud-alert-preview.state">State</Trans>
          </th>
          <th>
            <Trans i18nKey="alerting.cloud-alert-preview.labels">Labels</Trans>
          </th>
          <th>
            <Trans i18nKey="alerting.cloud-alert-preview.info">Info</Trans>
          </th>
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
  table: css({
    width: '100%',
    margin: theme.spacing(2, 0),

    caption: {
      captionSide: 'top',
      color: theme.colors.text.primary,

      '& > span': {
        fontSize: theme.typography.bodySmall.fontSize,
        color: theme.colors.text.secondary,
      },
    },

    'td, th': {
      padding: theme.spacing(1, 1),
    },

    'td + td, th + th': {
      paddingLeft: theme.spacing(3),
    },

    'thead th': {
      '&:nth-child(1)': {
        width: '80px',
      },

      '&:nth-child(2)': {
        width: 'auto',
      },

      '&:nth-child(3)': {
        width: '40px',
      },
    },

    'td:nth-child(3)': {
      textAlign: 'center',
    },

    'tbody tr:nth-child(2n + 1)': {
      backgroundColor: theme.colors.background.secondary,
    },
  }),
  tagList: css({
    justifyContent: 'flex-start',
  }),
});

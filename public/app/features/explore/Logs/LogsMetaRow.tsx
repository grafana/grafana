import { css } from '@emotion/css';
import { memo } from 'react';

import { LogsDedupStrategy, type LogsMetaItem, LogsMetaKind, type Labels, store } from '@grafana/data';
import { shallowCompare } from '@grafana/data/dataframe';
import { t } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

import { LogLabels, LogLabelsList, type Props as LogLabelsProps } from '../../logs/components/LogLabels';
import { MetaInfoText, type MetaItemProps } from '../MetaInfoText';

import { type LogsVisualisationType } from './constants';
import { SETTINGS_KEYS } from './utils/logs';

const getStyles = () => ({
  metaContainer: css({
    flex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    '& span': {
      fontWeight: 'normal',
      lineHeight: '1.25em',
    },
  }),
});

export type Props = {
  meta: LogsMetaItem[];
  dedupStrategy: LogsDedupStrategy;
  dedupCount: number;
  displayedFields: string[];
  clearDisplayedFields: () => void;
  defaultDisplayedFields: string[];
  visualisationType: LogsVisualisationType;
};

export const LogsMetaRow = memo(
  ({
    meta,
    dedupStrategy,
    dedupCount,
    displayedFields,
    clearDisplayedFields,
    defaultDisplayedFields,
    visualisationType,
  }: Props) => {
    const style = useStyles2(getStyles);

    const logsMetaItem: Array<LogsMetaItem | MetaItemProps> = [...meta];

    // Add deduplication info
    if (dedupStrategy !== LogsDedupStrategy.none) {
      logsMetaItem.push({
        label: t('explore.logs-meta-row.label.deduplication-count', 'Deduplication count'),
        value: dedupCount,
        kind: LogsMetaKind.Number,
      });
    }

    // Add detected fields info
    if (
      visualisationType === 'logs' &&
      displayedFields?.length > 0 &&
      shallowCompare(displayedFields, defaultDisplayedFields) === false
    ) {
      logsMetaItem.push(
        {
          label: t('explore.logs-meta-row.label.showing-only-selected-fields', 'Showing only selected fields'),
          value: <LogLabelsList labels={displayedFields} />,
        },
        {
          label: '',
          value: (
            <Button variant="primary" fill="outline" size="sm" onClick={clearDisplayedFields}>
              {t('explore.logs-meta-row.show-original-line', 'Show original line')}
            </Button>
          ),
        }
      );
    }

    const onCommonLabelsToggle = (state: boolean) => {
      store.set(SETTINGS_KEYS.commonLabels, state);
    };

    const commonLabelsProps = {
      onDisplayMaxToggle: onCommonLabelsToggle,
      displayMax: 3,
      displayAll: store.getBool(SETTINGS_KEYS.commonLabels, false),
    };

    return (
      <>
        {logsMetaItem && (
          <div className={style.metaContainer}>
            <MetaInfoText
              metaItems={logsMetaItem.map((item) => {
                return {
                  label: item.label,
                  value: 'kind' in item ? renderMetaItem(item.value, item.kind, commonLabelsProps) : item.value,
                };
              })}
            />
          </div>
        )}
      </>
    );
  }
);

LogsMetaRow.displayName = 'LogsMetaRow';

function renderMetaItem(value: string | number | Labels, kind: LogsMetaKind, logLabelsProps: Partial<LogLabelsProps>) {
  if (typeof value === 'string' || typeof value === 'number') {
    return <>{value}</>;
  }
  if (kind === LogsMetaKind.LabelsMap) {
    return <LogLabels labels={value} {...logLabelsProps} />;
  }
  if (kind === LogsMetaKind.Error) {
    return <span className="logs-meta-item__error">{value.toString()}</span>;
  }
  console.error(`Meta type ${typeof value} ${value} not recognized.`);
  return <></>;
}

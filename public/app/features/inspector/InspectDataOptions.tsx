import * as React from 'react';

import { DataFrame, DataTransformerID, getFrameDisplayName, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, HorizontalGroup, Select, Switch, VerticalGroup, useStyles2 } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { DetailText } from 'app/features/inspector/DetailText';
import { GetDataOptions } from 'app/features/query/state/PanelQueryRunner';

import { getPanelInspectorStyles2 } from './styles';

interface Props {
  options: GetDataOptions;
  dataFrames: DataFrame[];
  transformationOptions: Array<SelectableValue<DataTransformerID>>;
  selectedDataFrame: number | DataTransformerID;
  downloadForExcel: boolean;
  onDataFrameChange: (item: SelectableValue<DataTransformerID | number>) => void;
  toggleDownloadForExcel: () => void;
  data?: DataFrame[];
  hasTransformations?: boolean;
  formattedDataDescription?: string;
  onOptionsChange?: (options: GetDataOptions) => void;
  actions?: React.ReactNode;
}

export const InspectDataOptions = ({
  options,
  actions,
  formattedDataDescription,
  onOptionsChange,
  hasTransformations,
  data,
  dataFrames,
  transformationOptions,
  selectedDataFrame,
  onDataFrameChange,
  downloadForExcel,
  toggleDownloadForExcel,
}: Props) => {
  const styles = useStyles2(getPanelInspectorStyles2);

  let dataSelect = dataFrames;
  if (selectedDataFrame === DataTransformerID.joinByField) {
    dataSelect = data!;
  }

  const choices = dataSelect.map<SelectableValue<number>>((frame, index) => {
    return {
      value: index,
      label: `${getFrameDisplayName(frame)} (${index})`,
    };
  });

  const selectableOptions = [...transformationOptions, ...choices];

  function getActiveString() {
    let activeString = '';

    if (!data) {
      return activeString;
    }

    const parts: string[] = [];

    if (selectedDataFrame === DataTransformerID.joinByField) {
      parts.push(t('dashboard.inspect-data.series-to-columns', 'Series joined by time'));
    } else if (data.length > 1) {
      parts.push(getFrameDisplayName(data[selectedDataFrame as number]));
    }

    if (options.withTransforms || options.withFieldConfig) {
      if (options.withTransforms) {
        parts.push(t('dashboard.inspect-data.panel-transforms', 'Panel transforms'));
      }

      if (options.withTransforms && options.withFieldConfig) {
      }

      if (options.withFieldConfig) {
        parts.push(t('dashboard.inspect-data.formatted', 'Formatted data'));
      }
    }

    if (downloadForExcel) {
      parts.push(t('dashboard.inspect-data.excel-header', 'Excel header'));
    }

    return parts.join(', ');
  }

  return (
    <div className={styles.dataDisplayOptions}>
      <QueryOperationRow
        id="Data options"
        index={0}
        title={t('dashboard.inspect-data.data-options', 'Data options')}
        headerElement={<DetailText>{getActiveString()}</DetailText>}
        isOpen={false}
        actions={actions}
      >
        <div className={styles.options} data-testid="dataOptions">
          <VerticalGroup spacing="none">
            {data!.length > 1 && (
              <Field label={t('dashboard.inspect-data.dataframe-label', 'Show data frame')}>
                <Select
                  options={selectableOptions}
                  value={selectedDataFrame}
                  onChange={onDataFrameChange}
                  width={30}
                  aria-label={t('dashboard.inspect-data.dataframe-aria-label', 'Select dataframe')}
                />
              </Field>
            )}

            <HorizontalGroup>
              {hasTransformations && onOptionsChange && (
                <Field
                  label={t('dashboard.inspect-data.transformations-label', 'Apply panel transformations')}
                  description={t(
                    'dashboard.inspect-data.transformations-description',
                    'Table data is displayed with transformations defined in the panel Transform tab.'
                  )}
                >
                  <Switch
                    value={!!options.withTransforms}
                    onChange={() => onOptionsChange({ ...options, withTransforms: !options.withTransforms })}
                  />
                </Field>
              )}
              {onOptionsChange && (
                <Field
                  label={t('dashboard.inspect-data.formatted-data-label', 'Formatted data')}
                  description={
                    formattedDataDescription ||
                    t(
                      'dashboard.inspect-data.formatted-data-description',
                      'Table data is formatted with options defined in the Field and Override tabs.'
                    )
                  }
                >
                  <Switch
                    id="formatted-data-toggle"
                    value={!!options.withFieldConfig}
                    onChange={() => onOptionsChange({ ...options, withFieldConfig: !options.withFieldConfig })}
                  />
                </Field>
              )}
              <Field
                label={t('dashboard.inspect-data.download-excel-label', 'Download for Excel')}
                description={t(
                  'dashboard.inspect-data.download-excel-description',
                  'Adds header to CSV for use with Excel'
                )}
              >
                <Switch id="excel-toggle" value={downloadForExcel} onChange={toggleDownloadForExcel} />
              </Field>
            </HorizontalGroup>
          </VerticalGroup>
        </div>
      </QueryOperationRow>
    </div>
  );
};

import React from 'react';

import { DataFrame, DataTransformerID, getFrameDisplayName, SelectableValue } from '@grafana/data';
import { Field, HorizontalGroup, Select, Switch, VerticalGroup, useStyles2 } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { t } from 'app/core/internationalization';
import { PanelModel } from 'app/features/dashboard/state';
import { DetailText } from 'app/features/inspector/DetailText';
import { GetDataOptions } from 'app/features/query/state/PanelQueryRunner';

import { getPanelInspectorStyles2 } from './styles';

interface Props {
  options: GetDataOptions;
  dataFrames: DataFrame[];
  transformId: DataTransformerID;
  transformationOptions: Array<SelectableValue<DataTransformerID>>;
  selectedDataFrame: number | DataTransformerID;
  downloadForExcel: boolean;
  onDataFrameChange: (item: SelectableValue<DataTransformerID | number>) => void;
  toggleDownloadForExcel: () => void;
  data?: DataFrame[];
  panel?: PanelModel;
  onOptionsChange?: (options: GetDataOptions) => void;
}

export const InspectDataOptions = ({
  options,
  onOptionsChange,
  panel,
  data,
  dataFrames,
  transformId,
  transformationOptions,
  selectedDataFrame,
  onDataFrameChange,
  downloadForExcel,
  toggleDownloadForExcel,
}: Props) => {
  const styles = useStyles2(getPanelInspectorStyles2);

  const panelTransformations = panel?.getTransformations();
  const showPanelTransformationsOption =
    Boolean(panelTransformations?.length) && (transformId as any) !== 'join by time';
  const showFieldConfigsOption = panel && !panel.plugin?.fieldConfigRegistry.isEmpty();

  let dataSelect = dataFrames;
  if (selectedDataFrame === DataTransformerID.joinByField) {
    dataSelect = data!;
  }

  const choices = dataSelect.map((frame, index) => {
    return {
      value: index,
      label: `${getFrameDisplayName(frame)} (${index})`,
    } as SelectableValue<number>;
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
              {showPanelTransformationsOption && onOptionsChange && (
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
              {showFieldConfigsOption && onOptionsChange && (
                <Field
                  label={t('dashboard.inspect-data.formatted-data-label', 'Formatted data')}
                  description={t(
                    'dashboard.inspect-data.formatted-data-description',
                    'Table data is formatted with options defined in the Field and Override tabs.'
                  )}
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

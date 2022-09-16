import { t } from '@lingui/macro';
import React, { FC } from 'react';

import { DataFrame, DataTransformerID, getFrameDisplayName, SelectableValue } from '@grafana/data';
import { Field, HorizontalGroup, Select, Switch, VerticalGroup } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { PanelModel } from 'app/features/dashboard/state';
import { DetailText } from 'app/features/inspector/DetailText';
import { GetDataOptions } from 'app/features/query/state/PanelQueryRunner';

import { getPanelInspectorStyles } from './styles';

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

export const InspectDataOptions: FC<Props> = ({
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
}) => {
  const styles = getPanelInspectorStyles();

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
      parts.push(t({ id: 'dashboard.inspect-data.series-to-columns', message: 'Series joined by time' }));
    } else if (data.length > 1) {
      parts.push(getFrameDisplayName(data[selectedDataFrame as number]));
    }

    if (options.withTransforms || options.withFieldConfig) {
      if (options.withTransforms) {
        parts.push(t({ id: 'dashboard.inspect-data.panel-transforms', message: 'Panel transforms' }));
      }

      if (options.withTransforms && options.withFieldConfig) {
      }

      if (options.withFieldConfig) {
        parts.push(t({ id: 'dashboard.inspect-data.formatted', message: 'Formatted data' }));
      }
    }

    if (downloadForExcel) {
      parts.push(t({ id: 'dashboard.inspect-data.excel-header', message: 'Excel header' }));
    }

    return parts.join(', ');
  }

  return (
    <div className={styles.dataDisplayOptions}>
      <QueryOperationRow
        id="Data options"
        index={0}
        title={t({ id: 'dashboard.inspect-data.data-options', message: 'Data options' })}
        headerElement={<DetailText>{getActiveString()}</DetailText>}
        isOpen={false}
      >
        <div className={styles.options} data-testid="dataOptions">
          <VerticalGroup spacing="none">
            {data!.length > 1 && (
              <Field label={t({ id: 'dashboard.inspect-data.dataframe-label', message: 'Show data frame' })}>
                <Select
                  options={selectableOptions}
                  value={selectedDataFrame}
                  onChange={onDataFrameChange}
                  width={30}
                  aria-label={t({ id: 'dashboard.inspect-data.dataframe-aria-label', message: 'Select dataframe' })}
                />
              </Field>
            )}

            <HorizontalGroup>
              {showPanelTransformationsOption && onOptionsChange && (
                <Field
                  label={t({
                    id: 'dashboard.inspect-data.transformations-label',
                    message: 'Apply panel transformations',
                  })}
                  description={t({
                    id: 'dashboard.inspect-data.transformations-description',
                    message: 'Table data is displayed with transformations defined in the panel Transform tab.',
                  })}
                >
                  <Switch
                    value={!!options.withTransforms}
                    onChange={() => onOptionsChange({ ...options, withTransforms: !options.withTransforms })}
                  />
                </Field>
              )}
              {showFieldConfigsOption && onOptionsChange && (
                <Field
                  label={t({ id: 'dashboard.inspect-data.formatted-data-label', message: 'Formatted data' })}
                  description={t({
                    id: 'dashboard.inspect-data.formatted-data-description',
                    message: 'Table data is formatted with options defined in the Field and Override tabs.',
                  })}
                >
                  <Switch
                    id="formatted-data-toggle"
                    value={!!options.withFieldConfig}
                    onChange={() => onOptionsChange({ ...options, withFieldConfig: !options.withFieldConfig })}
                  />
                </Field>
              )}
              <Field
                label={t({ id: 'dashboard.inspect-data.download-excel-label', message: 'Download for Excel' })}
                description={t({
                  id: 'dashboard.inspect-data.download-excel-description',
                  message: 'Adds header to CSV for use with Excel',
                })}
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

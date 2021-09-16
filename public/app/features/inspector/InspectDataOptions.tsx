import React, { FC } from 'react';
import { DataFrame, DataTransformerID, getFrameDisplayName, SelectableValue } from '@grafana/data';
import { Field, HorizontalGroup, Select, Switch, VerticalGroup } from '@grafana/ui';
import { getPanelInspectorStyles } from './styles';
import { GetDataOptions } from 'app/features/query/state/PanelQueryRunner';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { PanelModel } from 'app/features/dashboard/state';
import { DetailText } from 'app/features/inspector/DetailText';

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
  if (selectedDataFrame === DataTransformerID.seriesToColumns) {
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

    if (selectedDataFrame === DataTransformerID.seriesToColumns) {
      parts.push('Series joined by time');
    } else if (data.length > 1) {
      parts.push(getFrameDisplayName(data[selectedDataFrame as number]));
    }

    if (options.withTransforms || options.withFieldConfig) {
      if (options.withTransforms) {
        parts.push('Panel transforms');
      }

      if (options.withTransforms && options.withFieldConfig) {
      }

      if (options.withFieldConfig) {
        parts.push('Formatted data');
      }
    }

    if (downloadForExcel) {
      parts.push('Excel header');
    }

    return parts.join(', ');
  }

  return (
    <div className={styles.dataDisplayOptions}>
      <QueryOperationRow
        id="Data options"
        index={0}
        title="Data options"
        headerElement={<DetailText>{getActiveString()}</DetailText>}
        isOpen={false}
      >
        <div className={styles.options} data-testid="dataOptions">
          <VerticalGroup spacing="none">
            {data!.length > 1 && (
              <Field label="Show data frame">
                <Select
                  menuShouldPortal
                  options={selectableOptions}
                  value={selectedDataFrame}
                  onChange={onDataFrameChange}
                  width={30}
                  aria-label="Select dataframe"
                />
              </Field>
            )}

            <HorizontalGroup>
              {showPanelTransformationsOption && onOptionsChange && (
                <Field
                  label="Apply panel transformations"
                  description="Table data is displayed with transformations defined in the panel Transform tab."
                >
                  <Switch
                    value={!!options.withTransforms}
                    onChange={() => onOptionsChange({ ...options, withTransforms: !options.withTransforms })}
                  />
                </Field>
              )}
              {showFieldConfigsOption && onOptionsChange && (
                <Field
                  label="Formatted data"
                  description="Table data is formatted with options defined in the Field and Override tabs."
                >
                  <Switch
                    value={!!options.withFieldConfig}
                    onChange={() => onOptionsChange({ ...options, withFieldConfig: !options.withFieldConfig })}
                  />
                </Field>
              )}
              <Field label="Download for Excel" description="Adds header to CSV for use with Excel">
                <Switch value={downloadForExcel} onChange={toggleDownloadForExcel} />
              </Field>
            </HorizontalGroup>
          </VerticalGroup>
        </div>
      </QueryOperationRow>
    </div>
  );
};

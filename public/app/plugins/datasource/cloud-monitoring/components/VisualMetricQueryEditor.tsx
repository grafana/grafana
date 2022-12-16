import React, { useCallback, useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorRow } from '@grafana/experimental';

import CloudMonitoringDatasource from '../datasource';
import { getAlignmentPickerData, getMetricType, setMetricType } from '../functions';
import { CustomMetaData, MetricDescriptor, MetricKind, PreprocessorType, TimeSeriesList, ValueTypes } from '../types';

import { AliasBy } from './AliasBy';
import { Alignment } from './Alignment';
import { GroupBy } from './GroupBy';
import { LabelFilter } from './LabelFilter';
import { Metrics } from './Metrics';
import { Preprocessor } from './Preprocessor';

export interface Props {
  refId: string;
  customMetaData: CustomMetaData;
  variableOptionGroup: SelectableValue<string>;
  onChange: (query: TimeSeriesList) => void;
  query: TimeSeriesList;
  datasource: CloudMonitoringDatasource;
  aliasBy?: string;
  onChangeAliasBy: (aliasBy: string) => void;
}

function Editor({
  refId,
  query,
  datasource,
  onChange,
  customMetaData,
  variableOptionGroup,
  aliasBy,
  onChangeAliasBy,
}: React.PropsWithChildren<Props>) {
  const [labels, setLabels] = useState<{ [k: string]: any }>({});
  const { projectName, groupBys, crossSeriesReducer } = query;
  const metricType = getMetricType(query);

  useEffect(() => {
    if (projectName && metricType) {
      datasource.getLabels(metricType, refId, projectName).then((labels) => setLabels(labels));
    }
  }, [datasource, groupBys, metricType, projectName, refId, crossSeriesReducer]);

  const onMetricTypeChange = useCallback(
    ({ valueType, metricKind, type }: MetricDescriptor) => {
      const preprocessor =
        metricKind === MetricKind.GAUGE || valueType === ValueTypes.DISTRIBUTION
          ? PreprocessorType.None
          : PreprocessorType.Rate;
      const { perSeriesAligner } = getAlignmentPickerData(valueType, metricKind, query.perSeriesAligner, preprocessor);
      onChange({
        ...setMetricType(
          {
            ...query,
            perSeriesAligner,
          },
          type
        ),
        preprocessor,
      });
    },
    [onChange, query]
  );

  return (
    <Metrics
      refId={refId}
      projectName={query.projectName}
      metricType={metricType}
      templateVariableOptions={variableOptionGroup.options}
      datasource={datasource}
      onChange={onMetricTypeChange}
      onProjectChange={onChange}
      query={query}
    >
      {(metric) => {
        const onChangePreprocessor = (preprocessor: PreprocessorType) => {
          const { perSeriesAligner: psa } = query;
          let valueType = metric?.valueType;
          let metricKind = metric?.metricKind;
          const { perSeriesAligner } = getAlignmentPickerData(valueType, metricKind, psa, preprocessor);
          onChange({ ...query, perSeriesAligner, preprocessor });
        };

        return (
          <>
            <LabelFilter
              labels={labels}
              filters={query.filters!}
              onChange={(filters: string[]) => onChange({ ...query, filters })}
              variableOptionGroup={variableOptionGroup}
            />
            <EditorRow>
              <Preprocessor
                metricDescriptor={metric}
                preprocessor={query.preprocessor}
                onChangePreprocessor={onChangePreprocessor}
              />
              <GroupBy
                refId={refId}
                labels={Object.keys(labels)}
                query={query}
                onChange={onChange}
                variableOptionGroup={variableOptionGroup}
                metricDescriptor={metric}
              />
              <Alignment
                refId={refId}
                datasource={datasource}
                templateVariableOptions={variableOptionGroup.options}
                query={query}
                customMetaData={customMetaData}
                onChange={onChange}
                metricDescriptor={metric}
                preprocessor={query.preprocessor}
              />
              <AliasBy refId={refId} value={aliasBy} onChange={onChangeAliasBy} />
            </EditorRow>
          </>
        );
      }}
    </Metrics>
  );
}

export const VisualMetricQueryEditor = React.memo(Editor);

import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, QueryEditorProps, SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow } from '@grafana/experimental';
import { Button, useStyles2 } from '@grafana/ui';

import AzureMonitorDatasource from '../../azure_monitor/azure_monitor_datasource';
import { AzureMonitorDataSourceJsonData, AzureMonitorQuery } from '../../types';

type Props = QueryEditorProps<
  AzureMonitorDatasource,
  AzureMonitorQuery,
  AzureMonitorDataSourceJsonData
>;;

interface FilterSectionProps extends Props {
  columns?: [];
  database?: string;
}

export const FilterSection: React.FC<FilterSectionProps> = ({
  query,
  onChange,
//   datasource,
//   columns,
}) => {
  const [focus, setFocus] = useState(false);
  const styles = useStyles2(getStyles);

  return (
    <>
      <EditorRow>
        <EditorFieldGroup>
          <EditorField label="Filters" optional={true}>
            <>
              {/* {query.expression?.where?.expressions.length ? (
                <div className={styles.filters}>
                  {query.expression?.where?.expressions.map((_, i) => (
                    <div key={`filter${i}`}>
                      <KQLFilter
                        index={i}
                        focusNewGroup={focus}
                        setFocus={setFocus}
                        query={query}
                        onChange={onChange}
                        datasource={datasource}
                        columns={columns}
                        templateVariableOptions={templateVariableOptions}
                      />
                      {i < query.expression.where.expressions.length - 1 ? (
                        <Label className={styles.andLabel}>AND</Label>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null} */}
              <Button
                variant="secondary"
                onClick={
                    () => {
                  onChange({
                    ...query,
                  });
                  setFocus(true);
                }}
              >
                Add group
              </Button>
            </>
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    andLabel: css({
      margin: '8px',
    }),
    filters: css({
      marginBottom: '8px',
    }),
  };
};

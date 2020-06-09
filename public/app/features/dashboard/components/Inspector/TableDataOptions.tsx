import React, { FC } from 'react';
import { DataFrame, SelectableValue } from '@grafana/data';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { Select, Field, Form, InputControl, Switch, Button } from '@grafana/ui';

interface TableDataOptions {
  /** String for series joined by time*/
  selectedDataframe: DataFrame | string;
  applyFieldConfiguration: boolean;
  applyPanelTransformations: boolean;
}

interface Props extends TableDataOptions {
  dataframes: DataFrame[];
  onChange: (options: TableDataOptions) => void;
}

const generateSelectValues = (dataframes: DataFrame[]): Array<SelectableValue<DataFrame | string>> => {
  return [
    { label: 'Series joined by time', value: 'joined-by-time' },
    ...dataframes.map((dataframe, i) =>
      dataframe.name ? { label: dataframe.name, value: dataframe } : { label: `data frame ${i}`, value: dataframe }
    ),
  ];
};

export const TableDataOptions: FC<Props> = ({
  dataframes,
  selectedDataframe,
  applyFieldConfiguration,
  applyPanelTransformations,
  onChange,
}) => {
  const dataframeValues = generateSelectValues(dataframes);
  const defaultValues = {
    selectedDataframe,
    applyFieldConfiguration,
    applyPanelTransformations,
  };

  return (
    <QueryOperationRow>
      <Form defaultValues={defaultValues} onSubmit={onChange}>
        {({ register, control }) => (
          <>
            <Field label="Show data frame">
              <InputControl control={control} name="selectedDataframe" as={Select} options={dataframeValues} />
            </Field>
            <Field label="Apply field configuration">
              <Switch ref={register} name="applyFieldConfiguration" />
            </Field>
            <Field label="Apply panel transformations">
              <Switch ref={register} name="applyPanelTransformations" />
            </Field>
            <Button type="submit">Apply</Button>
          </>
        )}
      </Form>
    </QueryOperationRow>
  );
};

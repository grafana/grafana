import React, { ChangeEvent } from 'react';
import { InlineLabel, InlineField, InlineFieldRow, Input, Button, Icon, useTheme, stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { QuerySettingsProps } from './types';

const useParameters = (props: QuerySettingsProps): any => {
  const { options, onOptionsChange } = props;
  const { settings } = options;
  let parameters: any = {};
  const contextParameters =
    props.options.settings.contextParameters !== undefined ? props.options.settings.contextParameters : [];
  contextParameters.forEach((value: any, index: number) => {
    parameters['parameter_' + index] = value;
  });
  const setParameters = (parameters: any) => {
    onOptionsChange({
      ...options,
      settings: {
        ...settings,
        contextParameters: Object.entries(parameters).map((parameter: any) => parameter[1]),
      },
    });
  };
  return [parameters, setParameters];
};

export const DruidQueryContextSettings = (props: QuerySettingsProps) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [parameters, setParameters] = useParameters(props);
  const onParameterChange = (name: string, parameter: Parameter) => {
    setParameters({ ...parameters, [name]: parameter });
  };
  return (
    <InlineFieldRow className={cx(styles.row)}>
      <InlineLabel width="auto" tooltip="The query context is used for various query configuration parameters.">
        Context
      </InlineLabel>
      {Object.entries(parameters).map((parameter: any, index: number) => (
        <InlineFieldRow key={index} className={cx(styles.row)}>
          <ParameterRow
            key={parameter[0]}
            parameter={parameter[1]}
            onChange={(p) => {
              onParameterChange(parameter[0], p);
            }}
          />
          <Button
            variant="secondary"
            size="xs"
            onClick={(event) => {
              setParameters(Object.fromEntries(Object.entries(parameters).filter((_: any, i: number) => i !== index)));
              event.preventDefault();
            }}
          >
            <Icon name="trash-alt" />
          </Button>
        </InlineFieldRow>
      ))}
      <Button
        variant="secondary"
        icon="plus"
        onClick={(event) => {
          setParameters({
            ...parameters,
            ['parameter_' + Object.entries(parameters).length]: { name: '', value: '' },
          });
          event.preventDefault();
        }}
      >
        Add
      </Button>
    </InlineFieldRow>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    row: css`
      width: 100%;
      & > & {
        border-left: 1px solid ${theme.colors.border2};
        padding: 5px 0px 0px 10px;
      }
    `,
  };
});

interface Parameter {
  name: string;
  value: any;
}

interface ParameterRowProps {
  parameter: Parameter;
  onChange: (value: Parameter) => void;
}

const ParameterRow = ({ parameter, onChange }: ParameterRowProps) => {
  return (
    <InlineFieldRow>
      <InlineField label="Name">
        <Input
          name="name"
          placeholder="Parameter name. e.g: timeout"
          value={parameter.name || ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ ...parameter, name: e.target.value })}
        />
      </InlineField>
      <InlineField label="Value">
        <Input
          name="value"
          value={parameter.value}
          placeholder="parameter value. e.g: 10"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ ...parameter, value: e.target.value })}
        />
      </InlineField>
    </InlineFieldRow>
  );
};

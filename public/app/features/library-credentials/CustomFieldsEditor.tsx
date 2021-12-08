import React, { FunctionComponent, useState } from 'react';
import { Button, Field, FieldSet, Input, DeleteButton, HorizontalGroup, ToolbarButton } from '@grafana/ui';
import { KeyValue } from '@grafana/data';

export interface Props {
  onJsonDataChange: (jsonData: any) => void;
  onSecureJsonDataChange: (secureJsonData: any) => void;
  onSecureJsonFieldsChange: (secureJsonData: any) => void;
  jsonData: {
    [key: string]: any;
  };
  secureJsonFields: KeyValue<boolean>;
}

export const CustomFieldsEditor: FunctionComponent<Props> = ({
  jsonData = {},
  onJsonDataChange,
  onSecureJsonDataChange,
  onSecureJsonFieldsChange,
  secureJsonFields = {},
}) => {
  const [editJsonData, setEditJsonData] = useState(false);
  const [editJsonDataName, setEditJsonDataName] = useState('');
  const [editJsonDataValue, setEditJsonDataValue] = useState('');

  const [editSecureJsonData, setEditSecureJsonData] = useState(false);
  const [editSecureJsonDataName, setEditSecureJsonDataName] = useState('');
  const [editSecureJsonDataValue, setEditSecureJsonDataValue] = useState('');

  return (
    <>
      <FieldSet label="Fields">
        {Object.entries(jsonData).map(([key, value]) => {
          return (
            <HorizontalGroup key={key}>
              <Field label={key}>
                <Input
                  value={value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    onJsonDataChange(
                      Object.entries(jsonData).reduce((acc, [currKey, currValue]) => {
                        if (currKey === key) {
                          return { ...acc, [key]: e.target.value };
                        }
                        return { ...acc, [currKey]: currValue };
                      }, {})
                    );
                  }}
                  width={60}
                />
              </Field>
              <DeleteButton
                aria-label="Delete Library Credential"
                size="md"
                onConfirm={() => {
                  onJsonDataChange(
                    Object.entries(jsonData).reduce((acc, [currKey, currValue]) => {
                      if (currKey !== key) {
                        return { ...acc, [currKey]: currValue };
                      }
                      return acc;
                    }, {})
                  );
                }}
              />
            </HorizontalGroup>
          );
        })}

        {!editJsonData ? (
          <Button variant="secondary" icon="plus" type="button" onClick={() => setEditJsonData(true)}>
            Add field
          </Button>
        ) : (
          <>
            <Field label="Field name">
              <Input
                value={editJsonDataName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEditJsonDataName(e.target.value);
                }}
                width={60}
              />
            </Field>
            <Field label="Field value">
              <Input
                value={editJsonDataValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEditJsonDataValue(e.target.value);
                }}
                width={60}
              />
            </Field>
            <Button
              variant="secondary"
              icon="plus"
              type="button"
              onClick={(e) => {
                onJsonDataChange({ ...jsonData, [editJsonDataName]: editJsonDataValue });
                setEditJsonData(false);
              }}
            >
              Add
            </Button>
          </>
        )}
      </FieldSet>

      <FieldSet label="Secret fields">
        {Object.keys(secureJsonFields).map((key) => {
          return (
            <HorizontalGroup key={key}>
              <Field label={key} disabled>
                <Input width={60} placeholder="Configured" />
              </Field>
              <ToolbarButton icon="edit" type="button" tooltip="Edit Secret Access Key" onClick={() => {}} />
              <DeleteButton
                aria-label="Delete Library Credential"
                size="md"
                onConfirm={() => {
                  // TODO: implement this
                }}
              />
            </HorizontalGroup>
          );
        })}

        {!editSecureJsonData ? (
          <Button variant="secondary" icon="plus" type="button" onClick={() => setEditSecureJsonData(true)}>
            Add field
          </Button>
        ) : (
          <>
            <Field label="Field name">
              <Input
                value={editSecureJsonDataName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEditSecureJsonDataName(e.target.value);
                }}
                width={60}
              />
            </Field>
            <Field label="Field value">
              <Input
                value={editSecureJsonDataValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEditSecureJsonDataValue(e.target.value);
                }}
                width={60}
              />
            </Field>
            <Button
              variant="secondary"
              icon="plus"
              type="button"
              onClick={(e) => {
                onSecureJsonDataChange({ [editSecureJsonDataName]: editSecureJsonDataValue });
                onSecureJsonFieldsChange({ ...secureJsonFields, [editSecureJsonDataName]: true });
                setEditSecureJsonData(false);
              }}
            >
              Add
            </Button>
          </>
        )}
      </FieldSet>
    </>
  );
};

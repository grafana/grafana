import React, { ChangeEvent, useState } from 'react';

import { Button, Icon, InlineField, InlineFieldRow, Input } from '@grafana/ui';

import MappingsHelp from './MappingsHelp';

type Props = {
  mappings: string[];
  onChange: (mappings: string[]) => void;
  onDismiss: () => void;
  onRestoreHelp: () => void;
  showHelp: boolean;
};

export const MappingsConfiguration = (props: Props): JSX.Element => {
  const [mappings, setMappings] = useState(props.mappings || []);

  return (
    <div>
      <h3 className="page-heading">Label mappings</h3>
      {!props.showHelp && (
        <p>
          <Button fill="text" onClick={props.onRestoreHelp}>
            Learn how label mappings work
          </Button>
        </p>
      )}
      {props.showHelp && <MappingsHelp onDismiss={props.onDismiss} />}

      <div className="gf-form-group">
        {mappings.map((mapping, i) => (
          <InlineFieldRow key={i}>
            <InlineField label={`Mapping (${i + 1})`}>
              <Input
                width={50}
                onChange={(changeEvent: ChangeEvent<HTMLInputElement>) => {
                  let newMappings = mappings.concat();
                  newMappings[i] = changeEvent.target.value;
                  setMappings(newMappings);
                }}
                onBlur={() => {
                  props.onChange(mappings);
                }}
                placeholder="e.g. test.metric.(labelName).*"
                value={mapping}
              />
            </InlineField>
            <Button
              type="button"
              aria-label="Remove header"
              variant="secondary"
              size="xs"
              onClick={(_) => {
                let newMappings = mappings.concat();
                newMappings.splice(i, 1);
                setMappings(newMappings);
                props.onChange(newMappings);
              }}
            >
              <Icon name="trash-alt" />
            </Button>
          </InlineFieldRow>
        ))}
        <Button
          variant="secondary"
          icon="plus"
          type="button"
          onClick={() => {
            setMappings([...mappings, '']);
          }}
        >
          Add label mapping
        </Button>
      </div>
    </div>
  );
};

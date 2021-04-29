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

export const LokiLogsMappings = (props: Props): JSX.Element => {
  const [mappings, setMappings] = useState(props.mappings || []);

  return (
    <div>
      <h3 className="page-heading">Loki labels mappings</h3>
      {!props.showHelp && (
        <p>
          <Button onClick={props.onRestoreHelp} type="button" variant="secondary">
            Learn more
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
                placeholder="e.g. metric.test.(labelName).*"
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
      </div>
      <div className="gf-form">
        <Button
          variant="secondary"
          icon="plus"
          type="button"
          onClick={(e) => {
            setMappings([...mappings, '']);
          }}
        >
          Add label mapping
        </Button>
      </div>
    </div>
  );
};

import React, { ChangeEvent, useState } from 'react';
import { Button, Icon, InlineFormLabel, Input } from '@grafana/ui';

type Props = {
  mappings: string[];
  onChange: (mappings: string[]) => void;
};

export const LokiLogsMappings = (props: Props): JSX.Element => {
  const [mappings, setMappings] = useState(props.mappings || []);

  return (
    <div>
      <h3 className="page-heading">Loki lables mappings</h3>
      <div className="gf-form-group">
        {mappings.map((mapping, i) => (
          <div className="gf-form-inline" key={i}>
            <InlineFormLabel tooltip="Series to labels mapping">Mapping</InlineFormLabel>
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
          </div>
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

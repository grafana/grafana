import React, { ChangeEvent, useState } from 'react';
import { Alert, Button, Icon, InlineField, InlineFieldRow, Input } from '@grafana/ui';

type Props = {
  mappings: string[];
  onChange: (mappings: string[]) => void;
};

export const LokiLogsMappings = (props: Props): JSX.Element => {
  const [mappings, setMappings] = useState(props.mappings || []);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <h3 className="page-heading">Loki labels mappings</h3>
      <Alert severity="info" title="How to map Graphite metrics to Loki labels?">
        <p>
          When you switch data sources Graphite queries will be mapped to Loki queries according to defined mappings. To
          define a mapping write the full path of the metric and replace nodes you would like to map to labels with
          label name in parentheses.
        </p>
        {!isOpen && (
          <Button onClick={() => setIsOpen(!isOpen)} type="button" variant="secondary">
            More
          </Button>
        )}
        {isOpen && (
          <>
            <p>
              All tags are mapped automatically to labels. Graphite matching patterns (using &#123;&#125;) are converted
              to Loki&apos;s regular expressions matchers. You can use functions in your queries, metrics and tags will
              be extracted to match them with defined mappings.
            </p>
            <p>
              Example: for a mapping = <code>servers.(cluster).(server).*</code>:
            </p>
            <table>
              <thead>
                <tr>
                  <th>Graphite query</th>
                  <th>Mapped to Loki query</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>alias(servers.west.001.cpu,1,2)</code>
                  </td>
                  <td>
                    <code>&#123;cluster=&quot;west&quot;, server=&quot;001&quot;&#125;</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>alias(servers.*.&#123;001,002&#125;.*,1,2)</code>
                  </td>
                  <td>
                    <code>&#123;server=~&quot;(001|002)&quot;&#125;</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>interpolate(seriesByTag(&apos;foo=bar&apos;, &apos;server=002&apos;), inf))</code>
                  </td>
                  <td>
                    <code>&#123;foo=&quot;bar&quot;, server=&quot;002&quot;&#125;</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </Alert>
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

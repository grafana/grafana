import { Alert } from '@grafana/ui';
import React from 'react';

type Props = {
  onDismiss: () => void;
};

export default function MappingsHelp(props: Props): JSX.Element {
  return (
    <Alert severity="info" title="How to map Graphite metrics to Loki labels?" onRemove={props.onDismiss}>
      <p>
        When you switch data sources Graphite queries will be mapped to Loki queries according to defined mappings. To
        define a mapping write the full path of the metric and replace nodes you would like to map to labels with label
        name in parentheses.
      </p>
      <p>
        All tags are mapped automatically to labels. Graphite matching patterns (using &#123;&#125;) are converted to
        Loki&apos;s regular expressions matchers. You can use functions in your queries, metrics and tags will be
        extracted to match them with defined mappings.
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
    </Alert>
  );
}

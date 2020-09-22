// Libraries
import React, { PureComponent } from 'react';

// Types
import { PanelProps } from '@grafana/data';

interface Props extends PanelProps<any> {}

const dashboads = [
  { name: 'First Dashboard', path: 'path/to/first/one' },
  { name: 'Second Dashboard', path: 'path/to/second/one' },
];

export class DashGenPanel extends PureComponent<Props> {
  render() {
    return (
      <div>
        <ul>
          {dashboads.map(dash => (
            <li key={dash.path}>
              <a href={`dashboard/p/dashgen/${dash.path}`}>{dash.name}</a>
            </li>
          ))}
        </ul>
      </div>
    );
  }
}

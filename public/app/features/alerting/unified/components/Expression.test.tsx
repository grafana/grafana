import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { PluginType } from '@grafana/data';

import { Expression } from './Expression';

const expression =
  '100 - ( avg by ( agent_hostname ) ( rate ( node_cpu_seconds_total { mode = "idle" } [ 2h ] ) ) * 100 ) > 97';

const rulesSource = {
  id: 5,
  uid: 'gdev-prometheus',
  type: 'prometheus',
  name: 'gdev-prometheus',
  meta: {
    id: 'prometheus',
    type: PluginType.datasource,
    name: 'Prometheus',
    info: {
      author: {
        name: 'Grafana Labs',
        url: 'https://grafana.com',
      },
      description: 'Open source time series database & alerting',
      links: [
        {
          name: 'Learn more',
          url: 'https://prometheus.io/',
        },
      ],
      logos: {
        small: 'public/app/plugins/datasource/prometheus/img/prometheus_logo.svg',
        large: 'public/app/plugins/datasource/prometheus/img/prometheus_logo.svg',
      },
      build: {},
      screenshots: [],
      version: '',
      updated: '',
    },
    module: 'app/plugins/datasource/prometheus/module',
    baseUrl: 'public/app/plugins/datasource/prometheus',
  },
  url: '/api/datasources/proxy/5',
  access: 'proxy' as 'proxy',
  jsonData: {
    manageAlerts: true,
  },
  readOnly: false,
};

describe('Expression', () => {
  it('Should not allow to edit the text in the editor', () => {
    render(<Expression expression={expression} rulesSource={rulesSource} />);

    const editor = screen.getByTestId('expression-editor');
    userEvent.type(editor, 'something else');

    expect(editor).toHaveTextContent(expression);
    expect(editor).not.toHaveTextContent('something else');
  });
});

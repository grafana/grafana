import { render, screen } from '@testing-library/react';
import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import { getDefaultTimeRange, LoadingState, type PanelData, type PanelProps, toDataFrame } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setTemplateSrv } from '@grafana/runtime';

import { PanelRenderer } from './PanelRenderer';

const mockPlugin = getPanelPlugin({ id: 'greeting' }, ({ replaceVariables }: PanelProps) => (
  <span>{replaceVariables('${greeting}')}</span>
));

jest.mock('../../plugins/importPanelPlugin', () => ({
  importPanelPlugin: () => Promise.resolve(mockPlugin),
  syncGetPanelPlugin: () => mockPlugin,
}));

const data: PanelData = {
  series: [toDataFrame({ fields: [{ name: 'value', values: [1] }] })],
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
};

describe('PanelRenderer', () => {
  beforeAll(() => {
    setTemplateSrv(
      initTemplateSrv('panel-renderer', [
        { type: 'constant', name: 'greeting', current: { value: 'dashboard', text: 'dashboard' } },
      ])
    );
  });

  it('gives the panel the replaceVariables it is passed', () => {
    render(
      <PanelRenderer
        pluginId="greeting"
        title=""
        width={100}
        height={100}
        data={data}
        replaceVariables={(value) => value.replace('${greeting}', 'hello')}
      />
    );

    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('leaves variables in the panel uninterpolated without replaceVariables', () => {
    render(<PanelRenderer pluginId="greeting" title="" width={100} height={100} data={data} />);

    expect(screen.getByText('${greeting}')).toBeInTheDocument();
  });
});

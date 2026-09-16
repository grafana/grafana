import { render, screen } from 'test/test-utils';

import { type SceneQueryRunner } from '@grafana/scenes';

import { Workbench } from './Workbench';
import { type Domain } from './types';

// The labels column runs scene queries of its own, which need a scene context that is irrelevant here.
jest.mock('./scene/filters/LabelsColumn', () => ({ LabelsColumn: () => null }));

const domain: Domain = [new Date(0), new Date(60_000)];

function renderWorkbench(props: Partial<React.ComponentProps<typeof Workbench>> = {}) {
  return render(<Workbench data={[]} domain={domain} queryRunner={{} as SceneQueryRunner} {...props} />);
}

describe('Workbench', () => {
  it('says the data source query was denied instead of reporting that nothing is alerting', () => {
    renderWorkbench({ error: { status: 403, message: 'Access denied to data source' } });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/do not have permission to query it/i);
    expect(alert).toHaveTextContent('Access denied to data source');
    expect(screen.queryByText(/no firing or pending instances/i)).not.toBeInTheDocument();
  });

  it('reports any other query failure without claiming that nothing is alerting', () => {
    renderWorkbench({ error: { status: 500, message: 'Query error: 500 Internal Server Error' } });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/cannot tell which alerts are firing or pending/i);
    expect(alert).toHaveTextContent('Query error: 500 Internal Server Error');
    expect(screen.queryByText(/no firing or pending instances/i)).not.toBeInTheDocument();
  });

  it('keeps the empty state when the query succeeded and returned nothing', () => {
    renderWorkbench();

    expect(screen.getByText(/no firing or pending instances/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

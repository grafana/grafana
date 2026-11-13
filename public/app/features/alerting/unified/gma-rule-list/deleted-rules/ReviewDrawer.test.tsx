import { render, screen, userEvent } from 'test/test-utils';

import { makeDeletedRule } from '../mocks/handlers';

import { ReviewDrawer } from './ReviewDrawer';

describe('ReviewDrawer', () => {
  it('shows the rule title', () => {
    render(<ReviewDrawer rule={makeDeletedRule()} folderPath="Platform / Infra" onClose={jest.fn()} />);
    expect(screen.getByText('Deleted rule')).toBeInTheDocument();
  });

  it('shows the folder path', () => {
    render(<ReviewDrawer rule={makeDeletedRule()} folderPath="Platform / Infra" onClose={jest.fn()} />);
    expect(screen.getByText('Platform / Infra')).toBeInTheDocument();
  });

  it('calls onClose when closed', async () => {
    const onClose = jest.fn();
    render(<ReviewDrawer rule={makeDeletedRule()} folderPath="Platform / Infra" onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('reveals K8s JSON when Advanced section is expanded', async () => {
    render(<ReviewDrawer rule={makeDeletedRule()} folderPath="Platform / Infra" onClose={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Advanced/i }));
    expect(screen.getByRole('code')).toBeInTheDocument();
  });

  it('JSON does not contain access annotations', async () => {
    const rule = makeDeletedRule();
    rule.metadata.annotations = { 'grafana.com/access/canWrite': 'true', 'grafana.app/folder': 'f1' };
    render(<ReviewDrawer rule={rule} folderPath="f1" onClose={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Advanced/i }));
    const json = screen.getByRole('code').textContent ?? '';
    expect(json).not.toContain('canWrite');
    expect(json).toContain('grafana.app/folder');
  });
});

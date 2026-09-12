import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Props as AutoSizerProps } from 'react-virtualized-auto-sizer';

import { getDefaultTimeRange, LoadingState, type PanelData } from '@grafana/data';
import { type CodeMirrorEditorProps } from '@grafana/ui/unstable';

import { InspectJSONTab } from './InspectJSONTab';

jest.mock('react-virtualized-auto-sizer', () => ({
  __esModule: true,
  default: ({ children }: AutoSizerProps) => children({ height: 480, scaledHeight: 480, scaledWidth: 800, width: 800 }),
}));

jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  CodeMirrorEditor: (props: CodeMirrorEditorProps) => (
    <textarea
      aria-label={props['aria-label']}
      readOnly={props.readOnly}
      value={props.value}
      onChange={(event) => props.onChange(event.currentTarget.value)}
      onBlur={(event) => props.onBlur?.(event.currentTarget.value)}
    />
  ),
}));

jest.mock('../search/page/reporting', () => ({
  reportPanelInspectInteraction: jest.fn(),
}));

const data = {
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
  series: [],
} satisfies PanelData;

describe('InspectJSONTab', () => {
  it('switches read-only Explore JSON sources', async () => {
    const user = userEvent.setup();
    render(<InspectJSONTab data={data} onClose={jest.fn()} />);

    const editor = await screen.findByRole('textbox', { name: 'JSON content' });
    expect(editor).toHaveValue('[]');
    expect(editor).toHaveAttribute('readonly');

    await user.click(screen.getByRole('combobox', { name: 'Select source' }));
    await user.click(screen.getByText('Panel data'));

    await waitFor(() => expect(editor).toHaveValue(JSON.stringify(data, null, 2)));
    expect(editor).toHaveAttribute('readonly');
  });
});

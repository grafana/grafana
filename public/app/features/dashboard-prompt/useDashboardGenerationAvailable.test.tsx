import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { useAssistant } from '@grafana/assistant';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { useDashboardGenerationAvailable } from './useDashboardGenerationAvailable';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
}));

const mockUseAssistant = jest.mocked(useAssistant);

function Probe() {
  return <span>{useDashboardGenerationAvailable() ? 'available' : 'unavailable'}</span>;
}

/** `render` from test-utils supplies the OpenFeatureProvider the flag hook needs. */
function setup({ flag, assistant }: { flag: boolean; assistant: boolean }) {
  setTestFlags({ 'dashboard.generation': flag });
  mockUseAssistant.mockReturnValue({ isAvailable: assistant } as ReturnType<typeof useAssistant>);
  render(<Probe />);
}

describe('useDashboardGenerationAvailable', () => {
  it('is available when the flag is on and the assistant is there', () => {
    setup({ flag: true, assistant: true });
    expect(screen.getByText('available')).toBeInTheDocument();
  });

  it('is unavailable when the flag is off', () => {
    setup({ flag: false, assistant: true });
    expect(screen.getByText('unavailable')).toBeInTheDocument();
  });

  it('is unavailable when the assistant is missing, even with the flag on', () => {
    setup({ flag: true, assistant: false });
    expect(screen.getByText('unavailable')).toBeInTheDocument();
  });
});

import { render, screen } from 'test/test-utils';

import { NotebookEmbeddedHost, useIsNotebookEmbedded } from './NotebookEmbeddedContext';

function Probe({ label }: { label: string }) {
  return <span data-testid={label}>{String(useIsNotebookEmbedded())}</span>;
}

describe('useIsNotebookEmbedded', () => {
  // The /notebooks route wraps nothing, so the default is what it gets.
  it('is false with no host above it', () => {
    render(<Probe label="plain" />);

    expect(screen.getByTestId('plain')).toHaveTextContent('false');
  });

  it('is true inside a host', () => {
    render(
      <NotebookEmbeddedHost>
        <Probe label="hosted" />
      </NotebookEmbeddedHost>
    );

    expect(screen.getByTestId('hosted')).toHaveTextContent('true');
  });

  /**
   * The reason this is a context and not scene state.
   *
   * One notebook can be on screen twice — the route and a host with no app header — and those two
   * share a single scene object, deliberately, so that they share a single autosave. A flag on that
   * object answers once for both: whichever mounted last wins, and the route ends up with its sticky
   * controls row offset to 0 and sitting under the header. Only the tree can answer per mount.
   */
  it('answers differently for two trees rendering the same document', () => {
    render(
      <>
        <NotebookEmbeddedHost>
          <Probe label="in-host" />
        </NotebookEmbeddedHost>
        <Probe label="on-route" />
      </>
    );

    expect(screen.getByTestId('in-host')).toHaveTextContent('true');
    expect(screen.getByTestId('on-route')).toHaveTextContent('false');
  });
});

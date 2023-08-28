import { render, screen } from '@testing-library/react';
import React, { ComponentProps } from 'react';

import { createTheme } from '@grafana/data';

import { LogMessage } from './LogMessage';
import { getLogRowStyles } from './getLogRowStyles';

const LOG_MULTILINE_ENTRY = `[2020-12-03 11:36:23] ERROR in app: Exception on /error [GET]
Traceback (most recent call last):
  File "/home/pallets/.pyenv/versions/3.8.5/lib/python3.8/site-packages/flask/app.py", line 2447, in wsgi_app
    response = self.full_dispatch_request()
  File "/home/pallets/.pyenv/versions/3.8.5/lib/python3.8/site-packages/flask/app.py", line 1952, in full_dispatch_request
    rv = self.handle_user_exception(e)
  File "/home/pallets/.pyenv/versions/3.8.5/lib/python3.8/site-packages/flask/app.py", line 1821, in handle_user_exception
    reraise(exc_type, exc_value, tb)
  File "/home/pallets/.pyenv/versions/3.8.5/lib/python3.8/site-packages/flask/_compat.py", line 39, in reraise
    raise value
  File "/home/pallets/.pyenv/versions/3.8.5/lib/python3.8/site-packages/flask/app.py", line 1950, in full_dispatch_request
    rv = self.dispatch_request()
  File "/home/pallets/.pyenv/versions/3.8.5/lib/python3.8/site-packages/flask/app.py", line 1936, in dispatch_request
    return self.view_functions[rule.endpoint](**req.view_args)
  File "/home/pallets/src/deployment_tools/hello.py", line 10, in error
    raise Exception("Sorry, this route always breaks")
Exception: Sorry, this route always breaks`;
const LOG_LONG_SINGLE_LINE_ENTRY = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum eu nisl varius, hendrerit velit faucibus, dictum nisi. Cras facilisis vestibulum mollis. Curabitur congue suscipit quam. Cras efficitur vitae ligula vitae rhoncus. Integer auctor condimentum ligula eu semper. Pellentesque eleifend lectus nulla, eu auctor nisl vehicula eget. Mauris consectetur dui eu justo placerat, nec consectetur tortor fermentum. Nunc vitae quam vitae ante pretium aliquet eget in lectus.Ut mollis eros vel interdum placerat. Maecenas ultrices arcu risus, eu elementum dui blandit id. Integer lobortis pulvinar dictum. Maecenas quis ipsum faucibus, porta massa vulputate, maximus nibh. Morbi dapibus porta pulvinar. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus non nisl mauris. Interdum et malesuada fames ac ante ipsum primis in faucibus.Integer et vestibulum nulla. Phasellus metus diam, sagittis consequat enim placerat, fermentum sodales ante. Vivamus pretium, odio sagittis laoreet semper, urna diam aliquam magna, a tristique dolor nunc et arcu. Aenean a accumsan turpis, eget ultricies risus. Aenean ut luctus ligula, ornare tincidunt nisi. Aenean a nisl ac lectus ultrices interdum. Pellentesque condimentum dui nec urna dapibus, ornare consequat lorem suscipit.`;
const LOG_SMALL_SINGLE_LINE_ENTRY = `test123`;

const setup = (entry: string, expandLogMessage: boolean): string => {
  const theme = createTheme();
  const styles = getLogRowStyles(theme);
  const { rerender } = render(
    <LogMessage hasAnsi={false} highlights={[]} entry={entry} styles={styles} expandLogMessage={expandLogMessage} />
  );
  return styles.truncateToOneLine;
};

const setupHighlightedLogMessage = () => {
  const theme = createTheme();
  const styles = getLogRowStyles(theme);
  const { rerender } = render(
    <LogMessage
      hasAnsi={false}
      highlights={['test', 'yuk']}
      entry={'asd123 test rty yuk'}
      styles={styles}
      expandLogMessage={false}
    />
  );
};

describe('LogMessage must handle correctly highlights', () => {
  it('Must highlight all matching string in a log message', () => {
    setupHighlightedLogMessage();
    expect(screen.queryByText(/.*test*/).tagName.toLowerCase()).toContain('mark');
    expect(screen.queryByText(/.*test*/).className).toMatch(/.*highlight.*/);

    expect(screen.queryByText(/.*yuk*/).tagName.toLowerCase()).toContain('mark');
    expect(screen.queryByText(/.*yuk*/).className).toMatch(/.*highlight.*/);
  });
  it('Must not highlight text not specified in the highlighs array', () => {
    setupHighlightedLogMessage();
    expect(screen.queryByText(/.*asd123*/).tagName.toLowerCase()).not.toContain('mark');
    expect(screen.queryByText(/.*asd123*/).className).not.toMatch(/.*highlight.*/);
  });
});

describe('LogMessage must handle ANSI codes', () => {
  it('Must render LogMessageAnsi there are ANSI codes in the entry and hasAnsi is true', () => {
    const theme = createTheme();
    const styles = getLogRowStyles(theme);
    const { rerender } = render(
      <LogMessage
        hasAnsi={true}
        highlights={[]}
        entry={'Lorem \u001B[31mipsum\u001B[0m et dolor'}
        styles={styles}
        expandLogMessage={true}
      />
    );
    expect(screen.queryByTestId('ansiLogLine')).toBeInTheDocument();
  });
  it('Must not ender LogMessageAnsi there are ANSI codes in the entry and hasAnsi is false', () => {
    const theme = createTheme();
    const styles = getLogRowStyles(theme);
    const { rerender } = render(
      <LogMessage
        hasAnsi={false}
        highlights={[]}
        entry={'Lorem ipsum et dolor'}
        styles={styles}
        expandLogMessage={true}
      />
    );
    expect(screen.queryByTestId('ansiLogLine')).not.toBeInTheDocument();
  });
});

describe('LogRowMessage must show only the first line of a message when expandLogMessage is set to false', () => {
  it('When the message is multiline', () => {
    const expectedClass = setup(LOG_MULTILINE_ENTRY, false);
    expect(screen.queryByText(/.*ERROR in app: Exception on \/error.*/)).toBeInTheDocument();
    expect(screen.queryByText(/.*ERROR in app: Exception on \/error.*/)).toHaveClass(expectedClass);
  });
  it('When the message is single long line', () => {
    const expectedClass = setup(LOG_LONG_SINGLE_LINE_ENTRY, false);
    expect(screen.queryByText(/.*Lorem ipsum dolor sit amet*/)).toBeInTheDocument();
    expect(screen.queryByText(/.*Lorem ipsum dolor sit amet*/)).toHaveClass(expectedClass);
  });
  it('When the message is single small line', () => {
    const expectedClass = setup(LOG_SMALL_SINGLE_LINE_ENTRY, false);
    expect(screen.queryByText(/.*test123*/)).toBeInTheDocument();
    expect(screen.queryByText(/.*test123*/)).toHaveClass(expectedClass);
  });
});

describe('LogMessage must show all lines of a message when expandLogMessage is set to true', () => {
  it('When the message is multiline', () => {
    const expectedClass = setup(LOG_MULTILINE_ENTRY, true);
    expect(screen.queryByText(/.*ERROR in app: Exception on \/error.*/)).toBeInTheDocument();
    expect(screen.queryByText(/.*ERROR in app: Exception on \/error.*/)).not.toHaveClass(expectedClass);
  });
  it('When the message is single long line', () => {
    const expectedClass = setup(LOG_LONG_SINGLE_LINE_ENTRY, true);
    expect(screen.queryByText(/.*Lorem ipsum dolor sit amet*/)).toBeInTheDocument();
    expect(screen.queryByText(/.*Lorem ipsum dolor sit amet*/)).not.toHaveClass(expectedClass);
  });
  it('When the message is single small line', () => {
    const expectedClass = setup(LOG_SMALL_SINGLE_LINE_ENTRY, true);
    expect(screen.queryByText(/.*test123*/)).toBeInTheDocument();
    expect(screen.queryByText(/.*test123*/)).not.toHaveClass(expectedClass);
  });
});

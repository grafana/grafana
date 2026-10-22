import { language } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { HttpResponse, http } from 'msw';
import { type SetupServer } from 'msw/node';
import { type JSX, default as React } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Provider } from 'react-redux';
import { render, screen, waitFor, within } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { Components } from '@grafana/e2e-selectors';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { configureStore } from 'app/store/configureStore';

import { type TemplatePreviewResponse, type TemplatesTestPayload, previewTemplateUrl } from '../../api/templateApi';
import {
  REJECTED_PREVIEW_RESPONSE,
  mockPreviewTemplateResponse,
  mockPreviewTemplateResponseRejected,
} from '../../mocks/templatesApi';

import { type TemplateFormValues, defaults } from './TemplateForm';
import { TemplatePreview } from './TemplatePreview';

jest.mock(
  'react-virtualized-auto-sizer',
  () =>
    ({ children }: { children: ({ height, width }: { height: number; width: number }) => JSX.Element }) =>
      children({ height: 500, width: 400 })
);

const getProviderWraper = () => {
  return function Wrapper({ children }: React.PropsWithChildren<{}>) {
    const store = configureStore();
    const formApi = useForm<TemplateFormValues>({ defaultValues: defaults });
    return (
      <Provider store={store}>
        <FormProvider {...formApi}>{children}</FormProvider>
      </Provider>
    );
  };
};

const server = setupMswServer();

const ui = {
  errorAlert: byRole('alert', { name: /error/i }),
  resultItems: byRole('listitem'),
};

// Captures the bodies of preview requests so tests can assert what the UI sends to the backend.
function capturePreviewRequests(srv: SetupServer): TemplatesTestPayload[] {
  const requests: TemplatesTestPayload[] = [];
  srv.use(
    http.post(previewTemplateUrl, async ({ request }) => {
      requests.push((await request.json()) as TemplatesTestPayload);
      return HttpResponse.json<TemplatePreviewResponse>({ results: [] });
    })
  );
  return requests;
}

describe('TemplatePreview component', () => {
  it('Should render error if payload has wrong format', async () => {
    render(
      <TemplatePreview
        payload={'bla bla bla'}
        templateName="potato"
        templateContent={`{{ define "potato" }}{{ . }}{{ end }}`}
        payloadFormatError={'Unexpected token b in JSON at position 0'}
        setPayloadFormatError={jest.fn()}
      />,
      { wrapper: getProviderWraper() }
    );
    await waitFor(() => {
      expect(ui.errorAlert.get()).toHaveTextContent('Unexpected token b in JSON at position 0');
    });
  });

  it('Should render error if payload is not an iterable', async () => {
    const setError = jest.fn();
    render(
      <TemplatePreview
        payload={'{"a":"b"}'}
        templateName="potato"
        templateContent={`{{ define "potato" }}{{ . }}{{ end }}`}
        payloadFormatError={'Unexpected token b in JSON at position 0'}
        setPayloadFormatError={setError}
      />,
      { wrapper: getProviderWraper() }
    );
    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith('alertList is not iterable');
    });
  });

  it('Should render error if payload has wrong format rendering the preview', async () => {
    render(
      <TemplatePreview
        payload={'potatos and cherries'}
        templateName="potato"
        templateContent={`{{ define "potato" }}{{ . }}{{ end }}`}
        payloadFormatError={'Unexpected token b in JSON at position 0'}
        setPayloadFormatError={jest.fn()}
      />,
      {
        wrapper: getProviderWraper(),
      }
    );

    await waitFor(() => {
      expect(ui.errorAlert.get()).toHaveTextContent('Unexpected token b in JSON at position 0');
    });
  });

  it('Should render error in preview response , if payload has correct format but preview request has been rejected', async () => {
    mockPreviewTemplateResponseRejected(server);
    render(
      <TemplatePreview
        payload={'[{"a":"b"}]'}
        templateName="potato"
        templateContent={`{{ define "potato" }}{{ . }}{{ end }}`}
        payloadFormatError={null}
        setPayloadFormatError={jest.fn()}
      />,
      { wrapper: getProviderWraper() }
    );

    await waitFor(() => {
      expect(ui.errorAlert.get()).toHaveTextContent(REJECTED_PREVIEW_RESPONSE);
    });
  });

  it('Should render preview response , if payload has correct ', async () => {
    const response: TemplatePreviewResponse = {
      results: [
        { name: 'template1', text: 'This is the template result bla bla bla' },
        { name: 'template2', text: 'This is the template2 result bla bla bla' },
      ],
    };
    mockPreviewTemplateResponse(server, response);
    const { user } = render(
      <TemplatePreview
        payload={'[{"a":"b"}]'}
        templateName="potato"
        templateContent={`{{ define "potato" }}{{ . }}{{ end }}`}
        payloadFormatError={null}
        setPayloadFormatError={jest.fn()}
      />,
      { wrapper: getProviderWraper() }
    );

    const previews = ui.resultItems.getAll;
    await waitFor(() => {
      expect(previews()).toHaveLength(2);
    });
    const previewItems = previews();
    expect(within(previewItems[0]).getByRole('banner')).toHaveTextContent('template1');
    expect(await within(previewItems[0]).findByRole('textbox', { name: 'template1' })).toHaveTextContent(
      'This is the template result bla bla bla'
    );
    expect(within(previewItems[1]).getByRole('banner')).toHaveTextContent('template2');
    expect(await within(previewItems[1]).findByRole('textbox', { name: 'template2' })).toHaveTextContent(
      'This is the template2 result bla bla bla'
    );

    mockPreviewTemplateResponse(server, {
      results: [{ name: 'template1', text: 'Updated template result' }],
    });
    await user.click(screen.getByRole('button', { name: 'Refresh preview' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'template1' })).toHaveTextContent('Updated template result')
    );
  });

  it('Should send the template kind in the preview request', async () => {
    const requests = capturePreviewRequests(server);
    render(
      <TemplatePreview
        payload={'[{"a":"b"}]'}
        templateName="potato"
        templateContent={`{{ define "potato" }}{{ . }}{{ end }}`}
        payloadFormatError={null}
        setPayloadFormatError={jest.fn()}
        kind="mimir"
      />,
      { wrapper: getProviderWraper() }
    );

    await waitFor(() => {
      expect(requests.length).toBeGreaterThan(0);
    });
    expect(requests.at(-1)).toMatchObject({ name: 'potato', kind: 'mimir' });
  });

  // When a new frontend runs against a backend that predates kind support, the request must not carry
  // anything the older backend would reject — omitting kind keeps the request backwards compatible.
  it('Should omit kind from the preview request when none is provided', async () => {
    const requests = capturePreviewRequests(server);
    render(
      <TemplatePreview
        payload={'[{"a":"b"}]'}
        templateName="potato"
        templateContent={`{{ define "potato" }}{{ . }}{{ end }}`}
        payloadFormatError={null}
        setPayloadFormatError={jest.fn()}
      />,
      { wrapper: getProviderWraper() }
    );

    await waitFor(() => {
      expect(requests.length).toBeGreaterThan(0);
    });
    expect(requests.at(-1)).toMatchObject({ name: 'potato' });
    expect(requests.at(-1)?.kind).toBeUndefined();
  });

  it('Should render preview response with some errors,  if payload has correct format ', async () => {
    const response: TemplatePreviewResponse = {
      results: [{ name: 'template1', text: 'This is the template result bla bla bla' }],
      errors: [
        { name: 'template2', message: 'Unexpected "{" in operand', kind: 'kind_of_error' },
        { name: 'template3', kind: 'kind_of_error', message: 'Unexpected "{" in operand' },
      ],
    };
    mockPreviewTemplateResponse(server, response);

    render(
      <TemplatePreview
        payload={'[{"a":"b"}]'}
        templateName="potato"
        templateContent={`{{ define "potato" }}{{ . }}{{ end }}`}
        payloadFormatError={null}
        setPayloadFormatError={jest.fn()}
      />,
      { wrapper: getProviderWraper() }
    );

    const alerts = () => screen.getAllByTestId(Components.Alert.alertV2('error'));
    await waitFor(() => {
      expect(alerts()).toHaveLength(2);
    });
    expect(alerts()[0]).toHaveTextContent(/Unexpected "{" in operand/i);
    expect(alerts()[1]).toHaveTextContent(/Unexpected "{" in operand/i);

    const previewContent = screen.getByRole('listitem');
    expect(await within(previewContent).findByRole('textbox', { name: 'template1' })).toHaveTextContent(
      'This is the template result bla bla bla'
    );
  });
});

it('renders read-only results with JSON highlighting only for valid JSON', async () => {
  const response = {
    results: [
      { name: 'template_text', text: 'This is the template result bla bla bla' },
      { name: 'template_valid', text: '{"test":"value","test2":"value2"}' },
      { name: 'template_invalid', text: '{"test":"value","test2":"value2",}' },
    ],
  } satisfies TemplatePreviewResponse;
  mockPreviewTemplateResponse(server, response);
  const { user } = render(
    <TemplatePreview
      payload={'[{"a":"b"}]'}
      templateName="potato"
      templateContent={`{{ define "potato" }}{{ . }}{{ end }}`}
      payloadFormatError={null}
      setPayloadFormatError={jest.fn()}
    />,
    { wrapper: getProviderWraper() }
  );

  const previews = ui.resultItems.getAll;
  await waitFor(() => {
    expect(previews()).toHaveLength(3);
  });
  const previewItems = previews();
  expect(within(previewItems[0]).getByRole('banner')).toHaveTextContent('template_text');
  expect(within(previewItems[0]).getByRole('banner')).toHaveTextContent('plaintext');
  expect(within(previewItems[1]).getByRole('banner')).toHaveTextContent('template_valid');
  expect(within(previewItems[1]).getByRole('banner')).toHaveTextContent('json');
  expect(within(previewItems[2]).getByRole('banner')).toHaveTextContent('template_invalid');
  expect(within(previewItems[2]).getByRole('banner')).toHaveTextContent('plaintext');

  for (const [index, result] of response.results.entries()) {
    const editor = await within(previewItems[index]).findByRole('textbox', { name: result.name });
    const view = EditorView.findFromDOM(editor)!;
    expect(editor).toHaveTextContent(result.text);
    expect(previewItems[index]).toHaveStyle({ flexShrink: 0 });
    expect(view.dom).toHaveStyle({ height: '100%' });
    expect(within(previewItems[index]).queryByText('1', { selector: '.cm-lineNumbers *' })).not.toBeInTheDocument();

    await user.click(editor);
    await user.paste('replacement');
    expect(editor).toHaveTextContent(result.text);

    expect(view.state.readOnly).toBe(true);
    await waitFor(() => expect(view.state.facet(language)?.name).toBe(index === 1 ? 'json' : undefined));
  }
});

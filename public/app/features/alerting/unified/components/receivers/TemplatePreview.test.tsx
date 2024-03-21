import { render, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { default as React } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Provider } from 'react-redux';
import { byRole } from 'testing-library-selector';

import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { configureStore } from 'app/store/configureStore';

import 'whatwg-fetch';
import { TemplatePreviewResponse } from '../../api/templateApi';
import { mockPreviewTemplateResponse, mockPreviewTemplateResponseRejected } from '../../mocks/templatesApi';

import { defaults, TemplateFormValues } from './TemplateForm';
import { TemplatePreview, PREVIEW_NOT_AVAILABLE } from './TemplatePreview';

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

const server = setupServer();

beforeAll(() => {
  setBackendSrv(backendSrv);
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

const ui = {
  errorAlert: byRole('alert', { name: /error/i }),
  resultItems: byRole('listitem'),
};

describe('TemplatePreview component', () => {
  it('Should render error if payload has wrong format', async () => {
    render(
      <TemplatePreview
        payload={'bla bla bla'}
        templateName="potato"
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
        payloadFormatError={null}
        setPayloadFormatError={jest.fn()}
      />,
      { wrapper: getProviderWraper() }
    );

    await waitFor(() => {
      expect(ui.errorAlert.get()).toHaveTextContent(PREVIEW_NOT_AVAILABLE);
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
    render(
      <TemplatePreview
        payload={'[{"a":"b"}]'}
        templateName="potato"
        payloadFormatError={null}
        setPayloadFormatError={jest.fn()}
      />,
      { wrapper: getProviderWraper() }
    );

    await waitFor(() => {
      const previews = ui.resultItems.getAll();
      expect(previews).toHaveLength(2);
      expect(previews[0]).toHaveTextContent('This is the template result bla bla bla');
      expect(previews[1]).toHaveTextContent('This is the template2 result bla bla bla');
    });
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
        payloadFormatError={null}
        setPayloadFormatError={jest.fn()}
      />,
      { wrapper: getProviderWraper() }
    );

    await waitFor(() => {
      const previews = ui.resultItems.getAll();
      expect(previews).toHaveLength(3);
      expect(previews[0]).toHaveTextContent('Unexpected "{" in operand');
      expect(previews[1]).toHaveTextContent('Unexpected "{" in operand');
      expect(previews[2]).toHaveTextContent('This is the template result bla bla bla');
    });
  });
});

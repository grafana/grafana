import { default as React } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Provider } from 'react-redux';
import { render, screen, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { Components } from '@grafana/e2e-selectors';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { configureStore } from 'app/store/configureStore';

import { TemplatePreviewResponse } from '../../api/templateApi';
import {
  REJECTED_PREVIEW_RESPONSE,
  mockPreviewTemplateResponse,
  mockPreviewTemplateResponseRejected,
} from '../../mocks/templatesApi';

import { TemplateFormValues, defaults } from './TemplateForm';
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
    render(
      <TemplatePreview
        payload={'[{"a":"b"}]'}
        templateName="potato"
        payloadFormatError={null}
        setPayloadFormatError={jest.fn()}
      />,
      { wrapper: getProviderWraper() }
    );

    const previews = ui.resultItems.getAll;
    await waitFor(() => {
      expect(previews()).toHaveLength(2);
    });
    expect(previews()[0]).toHaveTextContent('This is the template result bla bla bla');
    expect(previews()[1]).toHaveTextContent('This is the template2 result bla bla bla');
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

    const alerts = () => screen.getAllByTestId(Components.Alert.alertV2('error'));
    await waitFor(() => {
      expect(alerts()).toHaveLength(2);
    });
    expect(alerts()[0]).toHaveTextContent(/Unexpected "{" in operand/i);
    expect(alerts()[1]).toHaveTextContent(/Unexpected "{" in operand/i);

    const previewContent = screen.getByRole('listitem');
    expect(previewContent).toHaveTextContent('This is the template result bla bla bla');
  });
});

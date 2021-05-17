import React from 'react';
import { asyncScheduler, scheduled, throwError } from 'rxjs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ForgottenPassword, SendResetEmailDTO } from './ForgottenPassword';
import { backendSrv } from '../../services/backend_srv';
import { toAsyncOfResult } from '../../../features/query/state/DashboardQueryRunner/testHelpers';
import { createFetchResponse } from '../../../../test/helpers/createFetchResponse';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

function getTestContext() {
  jest.clearAllMocks();
  const fetchMock = jest.spyOn(backendSrv, 'fetch');
  const { rerender } = render(<ForgottenPassword />);

  return { fetchMock, rerender };
}

describe('ForgottenPassword', () => {
  describe('when mounted', () => {
    it('then it should show input field', () => {
      getTestContext();

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('then it should show send button', () => {
      getTestContext();

      expect(screen.getByText(/send reset email/i)).toBeInTheDocument();
    });

    it('then it should show back to login link', () => {
      getTestContext();

      expect(screen.getByText(/back to login/i)).toBeInTheDocument();
    });
  });

  describe('when user submits form', () => {
    describe('and response is ok', () => {
      it('then it should show success message', async () => {
        const { fetchMock } = getTestContext();
        fetchMock.mockImplementation(() =>
          toAsyncOfResult(
            createFetchResponse<SendResetEmailDTO>({ message: 'Success' })
          )
        );

        await userEvent.type(screen.getByRole('textbox'), 'JaneDoe');
        userEvent.click(screen.getByText(/send reset email/i));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

        expect(fetchMock).toHaveBeenCalledWith({
          url: '/api/user/password/send-reset-email',
          method: 'POST',
          data: { userOrEmail: 'JaneDoe' },
          showSuccessAlert: false,
          showErrorAlert: false,
        });
        expect(
          screen.getByText(
            /an email with a reset link has been sent to the email address\. you should receive it shortly\./i
          )
        ).toBeInTheDocument();
      });
    });

    describe('and response is ok but contains an error', () => {
      it('then it should show alert', async () => {
        const { fetchMock } = getTestContext();
        fetchMock.mockImplementation(() =>
          toAsyncOfResult(
            createFetchResponse<SendResetEmailDTO>({ message: 'Success', error: 'Something went wrong' })
          )
        );

        await userEvent.type(screen.getByRole('textbox'), 'JaneDoe');
        userEvent.click(screen.getByText(/send reset email/i));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

        expect(fetchMock).toHaveBeenCalledWith({
          url: '/api/user/password/send-reset-email',
          method: 'POST',
          data: { userOrEmail: 'JaneDoe' },
          showSuccessAlert: false,
          showErrorAlert: false,
        });
        expect(screen.getByLabelText(/alert error/i)).toBeInTheDocument();
        expect(screen.getByText(/couldn't send reset link to the email address/i)).toBeInTheDocument();
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });
    });

    describe('and response is not ok', () => {
      it('then it should show alert', async () => {
        const { fetchMock } = getTestContext();
        fetchMock.mockImplementation(() => scheduled(throwError('Server error'), asyncScheduler));

        await userEvent.type(screen.getByRole('textbox'), 'JaneDoe');
        userEvent.click(screen.getByText(/send reset email/i));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

        expect(fetchMock).toHaveBeenCalledWith({
          url: '/api/user/password/send-reset-email',
          method: 'POST',
          data: { userOrEmail: 'JaneDoe' },
          showSuccessAlert: false,
          showErrorAlert: false,
        });
        expect(screen.getByLabelText(/alert error/i)).toBeInTheDocument();
        expect(screen.getByText(/couldn't send reset link to the email address/i)).toBeInTheDocument();
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
    });
  });
});
